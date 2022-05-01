---
nav:
  path: /hooks
group:
  path: /use-request2
---

# 基础用法

这一小节我们会介绍 `useRequest` 最核心，最基础的能力，也就是 `useRequest` 内核的能力。

## 默认请求

默认情况下，`useRequest` 第一个参数是一个异步函数，在组件初始化时，会自动执行该异步函数。同时自动管理该异步函数的 `loading` , `data` , `error` 等状态。

```js
const { data, error, loading } = useRequest(service);
```

<br />

<code src="./demo/default.tsx" />

