import { useRef } from 'react';
import useCreation from '../../../useCreation';
import useUnmount from '../../../useUnmount';
import type { Plugin } from '../types';
import * as cache from '../utils/cache';
import type { CachedData } from '../utils/cache';
import * as cachePromise from '../utils/cachePromise';
import * as cacheSubscribe from '../utils/cacheSubscribe';

const useCachePlugin: Plugin<any, any[]> = (
  fetchInstance,
  {
    cacheKey,
    cacheTime = 5 * 60 * 1000,
    staleTime = 0,
    setCache: customSetCache,
    getCache: customGetCache,
  },
) => {
  const unSubscribeRef = useRef<() => void>();

  // 请求promise的ref,确保共享cacheKey时同一时刻只有一个请求
  const currentPromiseRef = useRef<Promise<any>>();

  const _setCache = (key: string, cachedData: CachedData) => {
    // 如果是自定义缓存，那就执行自定义的设置缓存方法
    if (customSetCache) {
      customSetCache(cachedData);
    } else {
      cache.setCache(key, cacheTime, cachedData);
    }
    // 发布缓存更新事件，所有订阅了缓存更新的组件都会收到缓存更新事件，然后执行订阅的回调
    cacheSubscribe.trigger(key, cachedData.data);
  };

  const _getCache = (key: string, params: any[] = []) => {
    // 如果是自定义缓存，那就执行自定义的取缓存方法
    if (customGetCache) {
      return customGetCache(params);
    }
    return cache.getCache(key);
  };

  // 初始化只执行一次，这里换成useMount应该效果一样
  // 这段的作用是在页面挂载时，还未开始做任何请求前，先把缓存拿到渲染页面
  useCreation(() => {
    // 只有设置了cacheKey才会缓存
    if (!cacheKey) {
      return;
    }

    // 初始化时从缓存中获取数据
    const cacheData = _getCache(cacheKey);
    // 取到了缓存同时里面有data这个属性，表示确实有数据
    // 因为缓存里包含data/time/params三个属性，所以可能出现有其它两个属性，但data属性不存在的情况
    if (cacheData && Object.hasOwnProperty.call(cacheData, 'data')) {
      // 直接把缓存里的数据设置给fetchInstance的状态
      fetchInstance.state.data = cacheData.data;
      fetchInstance.state.params = cacheData.params;
      // staleTime为-1表示不会过期，或者当前时间-缓存时间<staleTime时，表示还没过期，可以直接使用缓存的数据，此时不需要loading
      if (staleTime === -1 || new Date().getTime() - cacheData.time <= staleTime) {
        fetchInstance.state.loading = false;
      }
    }

    // subscribe same cachekey update, trigger update
    unSubscribeRef.current = cacheSubscribe.subscribe(cacheKey, (data) => {
      fetchInstance.setState({ data });
    });
  }, []);

  useUnmount(() => {
    // 卸载组件时要取消订阅
    unSubscribeRef.current?.();
  });

  if (!cacheKey) {
    return {};
  }

  return {
    onBefore: (params) => {
      // 在onBefore钩子中先获取缓存，这段逻辑同上
      const cacheData = _getCache(cacheKey, params);

      if (!cacheData || !Object.hasOwnProperty.call(cacheData, 'data')) {
        return {};
      }

      // If the data is fresh, stop request
      if (staleTime === -1 || new Date().getTime() - cacheData.time <= staleTime) {
        return {
          loading: false,
          data: cacheData?.data,
          returnNow: true, // returnNow不同于stopNow，后者也是结束请求但不返回数据，而returnNow会返回缓存的数据
        };
      } else {
        // 如果缓存过期，先返回缓存的数据给页面显示，同时继续请求
        return {
          data: cacheData?.data,
        };
      }
    },
    onRequest: (service, args) => {
      // 每次请求后（只是发起请求，不是指请求结束）都会把当前请求的promise设置给currentPromiseRef
      let servicePromise = cachePromise.getCachePromise(cacheKey);

      // 这段逻辑是为了复用promise请求，同时防止自身重复请求被阻止
      // 假设有A/B两个组件共享cacheKey，A开始请求，此时A的currentPromiseRef.current为空，缓存也为空，不会走进这个判断逻辑
      // A的请求会被赋到currentPromiseRef.current中，同时缓存起来
      // 当A的请求还没结束，B开始请求，此时B的currentPromiseRef.current为空，缓存为A的请求，两者不同会走这个判断逻辑
      // 此时B就会得到A的请求然后直接return，不再发起新的请求
      // 同理，当A的请求还没结束，A又再次发起请求，此时会发现currentPromiseRef.current和缓存中的promise是同一个
      // 就会跳过这段逻辑，开始新的请求
      if (servicePromise && servicePromise !== currentPromiseRef.current) {
        return { servicePromise };
      }
      // 在没有找到promise缓存的情况下，新建一个promise进行请求，并放入缓存中
      servicePromise = service(...args);
      currentPromiseRef.current = servicePromise;
      cachePromise.setCachePromise(cacheKey, servicePromise);
      return { servicePromise };
    },
    onSuccess: (data, params) => {
      if (cacheKey) {
        // 当请求成功，先取消自身的订阅，因为现在数据返回了，自己才是最新的数据的源头，不需要被通知更新
        unSubscribeRef.current?.();
        // 设置缓存，并设置当前时间供后面判断过期时间
        _setCache(cacheKey, {
          data,
          params,
          time: new Date().getTime(),
        });
        // 重新订阅，如果别的组件有新的数据返回，自己也会收到通知
        unSubscribeRef.current = cacheSubscribe.subscribe(cacheKey, (d) => {
          // 订阅的回调，就是把缓存中的新数据放到fetchInstance的data状态中
          fetchInstance.setState({ data: d });
        });
      }
    },
    onMutate: (data) => {
      if (cacheKey) {
        // 逻辑与onSuccess一样
        unSubscribeRef.current?.();
        _setCache(cacheKey, {
          data,
          params: fetchInstance.state.params,
          time: new Date().getTime(),
        });
        // resubscribe
        unSubscribeRef.current = cacheSubscribe.subscribe(cacheKey, (d) => {
          fetchInstance.setState({ data: d });
        });
      }
    },
  };
};

export default useCachePlugin;
