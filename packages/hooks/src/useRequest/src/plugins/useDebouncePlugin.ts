import type { DebouncedFunc, DebounceSettings } from 'lodash';
import debounce from 'lodash/debounce';
import { useEffect, useMemo, useRef } from 'react';
import type { Plugin } from '../types';

const useDebouncePlugin: Plugin<any, any[]> = (
  fetchInstance,
  { debounceWait, debounceLeading, debounceTrailing, debounceMaxWait },
) => {
  // debounce方法的ref
  const debouncedRef = useRef<DebouncedFunc<any>>();

  // 将传入的参数转换成lodash.debounce需要的参数
  const options = useMemo(() => {
    const ret: DebounceSettings = {};
    if (debounceLeading !== undefined) {
      ret.leading = debounceLeading;
    }
    if (debounceTrailing !== undefined) {
      ret.trailing = debounceTrailing;
    }
    if (debounceMaxWait !== undefined) {
      ret.maxWait = debounceMaxWait;
    }
    return ret;
  }, [debounceLeading, debounceTrailing, debounceMaxWait]);

  useEffect(() => {
    // debounceWait不为空时，才会执行debounce
    if (debounceWait) {
      // 保存原runAsync
      const _originRunAsync = fetchInstance.runAsync.bind(fetchInstance);

      // debouncedRef.current 注册为一个debounce方法
      debouncedRef.current = debounce(
        (callback) => {
          callback();
        },
        debounceWait,
        options,
      );

      // debounce runAsync should be promise
      // https://github.com/lodash/lodash/issues/4400#issuecomment-834800398
      fetchInstance.runAsync = (...args) => {
        return new Promise((resolve, reject) => {
          debouncedRef.current?.(() => {
            _originRunAsync(...args)
              .then(resolve)
              .catch(reject);
          });
        });
      };

      return () => {
        // debounceWait动态变化时，取消延迟的函数调用
        // 比如设置了一个很长的debounceWait，第一次触发后，还没开始请求，此时改变debounceWait，就要把那个还没开始的请求取消掉
        debouncedRef.current?.cancel();
        fetchInstance.runAsync = _originRunAsync;
      };
    }
  }, [debounceWait, options]);

  if (!debounceWait) {
    return {};
  }

  return {
    onCancel: () => {
      // 这个cancel方法是lodash.debounce提供的方法
      debouncedRef.current?.cancel();
    },
  };
};

export default useDebouncePlugin;
