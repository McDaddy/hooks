import { useEffect, useRef } from 'react';
import useUnmount from '../../../useUnmount';
import type { Plugin } from '../types';
import limit from '../utils/limit';
import subscribeFocus from '../utils/subscribeFocus';

const useRefreshOnWindowFocusPlugin: Plugin<any, any[]> = (
  fetchInstance,
  { refreshOnWindowFocus, focusTimespan = 15000 },
) => {
  const unsubscribeRef = useRef<() => void>();

  // 停止监听的函数 类似 usePollingPlugin 中的实现
  const stopSubscribe = () => {
    unsubscribeRef.current?.();
  };

  useEffect(() => {
    if (refreshOnWindowFocus) {
      // bind是为了在refresh方法中能拿到this
      const limitRefresh = limit(fetchInstance.refresh.bind(fetchInstance), focusTimespan);
      unsubscribeRef.current = subscribeFocus(() => {
        // 当重新被focus时，判断距离上次请求是否满focusTimespan，是的话触发请求
        limitRefresh();
      });
    }
    return () => {
      // 支持动态改变两个参数，每次改变都会把之前的监听给取消了
      stopSubscribe();
    };
  }, [refreshOnWindowFocus, focusTimespan]);

  useUnmount(() => {
    stopSubscribe();
  });

  return {};
};

export default useRefreshOnWindowFocusPlugin;
