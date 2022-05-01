import { useRef } from 'react';
import type { Plugin, Timeout } from '../types';

const useRetryPlugin: Plugin<any, any[]> = (fetchInstance, { retryInterval, retryCount }) => {
  const timerRef = useRef<Timeout>();
  // 触发重试的次数
  const countRef = useRef(0);

  // 表示这个请求是否是由重试触发的
  const triggerByRetry = useRef(false);

  // 必须有retryCount才能触发重试
  if (!retryCount) {
    return {};
  }

  return {
    onBefore: () => {
      // 如果是正常触发，即不是由重试触发的，则重置计数
      // 这里的作用是，如果在自动重试的过程中，用户手动触发了请求，重试次数就要归零
      if (!triggerByRetry.current) {
        countRef.current = 0;
      }
      // 不论是否是重试触发的，都要设置为false
      // triggerByRetry.current的作用只是为了在上面这个条件判断中使用
      // 如果后面再次出错，那又会重新被设置为true，否则这就会被当成是一次普通请求
      triggerByRetry.current = false;

      // 重置计时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    onSuccess: () => {
      // 成功了之后就要把计数器重置，否则下次请求如果出错，重试的次数就错了
      countRef.current = 0;
    },
    onError: () => {
      // 请求出错时，如果计数器小于retryCount，则计数器+1
      // 如果retryCount为-1，则表示不限制重试次数
      countRef.current += 1;
      if (retryCount === -1 || countRef.current <= retryCount) {
        // 如果不设置retryInterval，默认采用简易的指数退避算法，
        // 取 1000 * 2 ** retryCount，也就是第一次重试等待 2s，第二次重试等待 4s，以此类推，如果大于 30s，则取 30s
        const timeout = retryInterval ?? Math.min(1000 * 2 ** countRef.current, 30000);
        timerRef.current = setTimeout(() => {
          // 到达重试时间，触发refresh，同时设置triggerByRetry.current为true，表示这次请求是由重试触发的
          triggerByRetry.current = true;
          fetchInstance.refresh();
        }, timeout);
      } else {
        // 超过重试次数，不再重试，并把计数器归零
        countRef.current = 0;
      }
    },
    onCancel: () => {
      // 归零计数器并取消当前正在等待执行的重试
      countRef.current = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
  };
};

export default useRetryPlugin;
