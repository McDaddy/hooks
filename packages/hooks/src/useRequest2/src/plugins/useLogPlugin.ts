import type { Plugin } from '../types';

const useLogPlugin: Plugin<any, any[]> = () => {
  return {
    onBefore: () => {
      console.log('onBefore');
    },
    onRequest: () => {
      console.log('onRequest');
      return { servicePromise: Promise.resolve() };
    },
    onSuccess: () => {
      console.log('onSuccess');
    },
    onError: () => {
      console.log('onError');
    },
    onFinally: () => {
      console.log('onFinally');
    },
    onCancel: () => {
      console.log('onCancel');
    },
    onMutate: () => {
      console.log('onMutate');
    },
  };
};

useLogPlugin.onInit = () => {
  console.log('init log plugin');
  return {} as any;
};

export default useLogPlugin;
