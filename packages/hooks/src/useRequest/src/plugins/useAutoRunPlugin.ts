import { useRef } from 'react';
import useUpdateEffect from '../../../useUpdateEffect';
import type { Plugin } from '../types';

// support refreshDeps & ready
const useAutoRunPlugin: Plugin<any, any[]> = (
  fetchInstance,
  { manual, ready = true, defaultParams = [], refreshDeps = [], refreshDepsAction },
) => {
  // 标志位，用来标志是否自动请求
  const hasAutoRun = useRef(false);
  // 这句不是多余的，可以参考useLatest这个hook，目的是每次渲染时都重新给这个ref赋上值
  hasAutoRun.current = false;

  // 当ready变为true后，触发自动请求
  useUpdateEffect(() => {
    if (!manual && ready) {
      hasAutoRun.current = true;
      console.log('run: ');
      fetchInstance.run(...defaultParams);
    }
  }, [ready]);

  // 当依赖项变化时，重新请求
  useUpdateEffect(() => {
    if (hasAutoRun.current) {
      // 细节：当ready从false转为true后，首先要触发上面那个Effect，并把hasAutoRun.current设为true
      // 试想下如果在使用时，同时在组件里更改ready和refreshDeps的值，那么就会同时触发这两个Effect，
      // 导致的结果就是请求重复两次。 这个细节就能解决这个问题
      // 而当一次渲染结束之后，下次渲染开始，hasAutoRun.current又会被重置为false，此时再去改refreshDeps，就能正常触发refresh了
      // 同时，两个Effect的代码顺序也要固定，如果对调，不仅会发生上面的问题，还会导致refresh拿不到参数
      return;
    }
    if (!manual) {
      hasAutoRun.current = true;
      if (refreshDepsAction) {
        refreshDepsAction();
      } else {
        console.log('refresh: ');
        fetchInstance.refresh();
      }
    }
    // 这里是一个细节，必须用rest表达式把传入的数组中的每个值解构出来，传入deps
    // 如果不加这三个点，那么依赖的就是整个数组，在外面传值的时候，只要不被useMemo包裹，就会进入无限循环，页面卡死的情况
  }, [...refreshDeps]);

  return {
    onBefore: () => {
      // 每次发起请求，比如触发run方法，走到onBefore钩子，只要ready不为true，那么就会返回stopNow标志来停止请求
      if (!ready) {
        return {
          stopNow: true,
        };
      }
    },
  };
};

// 初始化plugin时，根据ready和manual两个值得到loading的初始状态
useAutoRunPlugin.onInit = ({ ready = true, manual }) => {
  return {
    loading: !manual && ready,
  };
};

export default useAutoRunPlugin;
