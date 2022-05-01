import type { MutableRefObject } from 'react';
import type { FetchState, Options, PluginReturn, Service, Subscribe } from './types';

export default class Fetch<TData, TParams extends any[]> {
  // 用于校验
  count: number = 0;
  // 注册在这个请求实例上的所有plugin
  pluginImpls: PluginReturn<TData, TParams>[];

  // 定义和初始化state状态，这就是最终会返回出去的4个状态
  state: FetchState<TData, TParams> = {
    loading: false,
    params: undefined,
    data: undefined,
    error: undefined,
  };

  // 构造函数接收，刚才的三个参数： service,options以及用于强制刷新的update
  constructor(
    public serviceRef: MutableRefObject<Service<TData, TParams>>,
    public options: Options<TData, TParams>,
    public subscribe: Subscribe,
    // 添加初始状态
    public initState: Partial<FetchState<TData, TParams>> = {},
  ) {
    this.state = {
      ...this.state,
      loading: !options.manual,
      ...initState,
    };
  }

  // 更新自身实例上的状态
  setState(s: Partial<FetchState<TData, TParams>> = {}) {
    this.state = {
      ...this.state,
      ...s,
    };
    // 触发渲染还是要通过外面传入的update
    this.subscribe();
  }

  runPluginHandler(event: keyof PluginReturn<TData, TParams>, ...rest: any[]) {
    // @ts-ignore
    const r = this.pluginImpls.map((i) => i[event]?.(...rest)).filter(Boolean);
    return Object.assign({}, ...r);
  }

  // 异步请求
  async runAsync(...params: TParams): Promise<TData> {
    // 每次请求都把count + 1，而这个count值就是当前这个请求的唯一性id
    // 当请求结束后，会将currentCount与全局count做一个比较
    // 如果不相等，说明这个请求中途已经被取消了，或者有一个更新的请求在它之后被发起，这种情况的结果都是需要被忽略的
    // 如果相同，再进行下一步的状态变更
    this.count += 1;
    const currentCount = this.count;

    const state = this.runPluginHandler('onBefore', params);

    // 请求开始前，把loading设为true，传入的params也放到state中
    this.setState({
      loading: true,
      params,
      ...state,
    });

    // 如果options里有onBefore函数，那么在这个时机执行
    this.options.onBefore?.(params);

    try {
      let { servicePromise } = this.runPluginHandler('onRequest', this.serviceRef.current, params);
      // 调用传入的serviceRef，会得到一个promise
      if (!servicePromise) {
        servicePromise = this.serviceRef.current(...params);
      }

      // await得到返回，这里有try/catch包裹，如果出错会走到catch里
      const res = await servicePromise;

      // 如果请求的id和全局count不一致，说明这个请求已经被取消了，直接返回空
      if (currentCount !== this.count) {
        // prevent run.then when request is canceled
        return new Promise(() => {});
      }

      // 此时请求已经结束，把loading设为false，因为没进catch所以error也设空，同时把data赋上结果res
      this.setState({
        data: res,
        error: undefined,
        loading: false,
      });

      // 如果有传onSuccess函数，那么在这个时机执行
      this.options.onSuccess?.(res, params);

      this.runPluginHandler('onSuccess', res, params);
      // 如果有传onFinally函数，那么在这个时机执行
      this.options.onFinally?.(params, res, undefined);

      if (currentCount === this.count) {
        this.runPluginHandler('onFinally', params, res, undefined);
      }

      return res;
    } catch (error) {
      // 同上
      if (currentCount !== this.count) {
        // prevent run.then when request is canceled
        return new Promise(() => {});
      }

      // 请求出错，依然要设置loading为false表示结束，同时设置error
      this.setState({
        error,
        loading: false,
      });
      // 如果有传onError函数，那么在这个时机执行
      this.options.onError?.(error, params);

      this.runPluginHandler('onError', error, params);
      // 如果有传onFinally函数，不论成功失败最终都会执行
      this.options.onFinally?.(params, undefined, error);

      if (currentCount === this.count) {
        this.runPluginHandler('onFinally', params, res, undefined);
      }
      // 抛出错误，如果调用的是run方法，那么还是会被捕获的，但直接调用runAsync就需要使用者自己去捕获了
      throw error;
    }
  }

  // 与runAsync的区别就是，这里不需要使用者去捕获错误
  run(...params: TParams) {
    this.runAsync(...params).catch((error) => {
      if (!this.options.onError) {
        console.error(error);
      }
    });
  }

  // 当调用cancel，就直接把全局count加1，当请求结束时就能发现自身已经被取消了
  cancel() {
    this.count += 1;
    this.setState({
      loading: false,
    });

    this.runPluginHandler('onCancel');
  }

  // 直接拿当前的请求参数再次发起一次请求
  refresh() {
    // @ts-ignore
    this.run(...(this.state.params || []));
  }

  // 同run与runAsync的关系
  refreshAsync() {
    // @ts-ignore
    return this.runAsync(...(this.state.params || []));
  }

  // 用于修改data
  mutate(data?: TData | ((oldData?: TData) => TData | undefined)) {
    let targetData: TData | undefined;
    if (typeof data === 'function') {
      // @ts-ignore
      targetData = data(this.state.data);
    } else {
      targetData = data;
    }

    this.runPluginHandler('onMutate', targetData);

    this.setState({
      data: targetData,
    });
  }
}
