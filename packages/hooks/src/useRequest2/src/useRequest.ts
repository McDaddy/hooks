import type { Options, Plugin, Result, Service } from './types';
import useMemoizedFn from 'ahooks/lib/useMemoizedFn';
import useCreation from 'ahooks/lib/useCreation';
import Fetch from './Fetch';
import useLatest from 'ahooks/lib/useLatest';
import useMount from 'ahooks/lib/useMount';
import useUnmount from 'ahooks/lib/useUnmount';
import useUpdate from 'ahooks/lib/useUpdate';

function useRequest<TData, TParams extends any[]>(
  service: Service<TData, TParams>,
  options: Options<TData, TParams> = {},
  plugins: Plugin<TData, TParams>[] = [],
) {
  // 使用useLatest包装一下service,实际就是一个ref,作用是无论传入的service方法实例是否变化,取到的都是ref值，而ref的好处就是不会重新触发渲染
  const serviceRef = useLatest(service);
  // useUpdate可以理解为触发强制刷新的方法
  const update = useUpdate();

  // useCreation可以理解为useMemo,目的是创建一个不变的实例
  const fetchInstance = useCreation(() => {
    const initState = plugins.map((p) => p?.onInit?.(options)).filter(Boolean);

    return new Fetch<TData, TParams>(serviceRef, options, update, Object.assign({}, ...initState));
  }, []);
  fetchInstance.options = options;
  // run all plugins hooks
  fetchInstance.pluginImpls = plugins.map((p) => p(fetchInstance, options));

  useMount(() => {
    // 在hook（组件）挂载时，如果options没有设置手动触发请求（manual），那么就自动触发请求
    if (!options.manual) {
      const params = options.defaultParams || [];
      // @ts-ignore
      fetchInstance.run(...params);
    }
  });

  useUnmount(() => {
    // 当卸载组件时，调用cancel方法，确保进行中的请求都能被正确取消
    fetchInstance.cancel();
  });

  return {
    loading: fetchInstance.state.loading,
    data: fetchInstance.state.data,
    error: fetchInstance.state.error,
    params: fetchInstance.state.params || [],
    cancel: useMemoizedFn(fetchInstance.cancel.bind(fetchInstance)),
    refresh: useMemoizedFn(fetchInstance.refresh.bind(fetchInstance)),
    refreshAsync: useMemoizedFn(fetchInstance.refreshAsync.bind(fetchInstance)),
    run: useMemoizedFn(fetchInstance.run.bind(fetchInstance)),
    runAsync: useMemoizedFn(fetchInstance.runAsync.bind(fetchInstance)),
    mutate: useMemoizedFn(fetchInstance.mutate.bind(fetchInstance)),
  } as Result<TData, TParams>;
}

export default useRequest;
