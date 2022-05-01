import React, { useState } from 'react';
import { useRequest } from 'ahooks';

const userSchool = (id: string) => {
  switch (id) {
    case '1':
      return 'Tsinghua University';
    case '2':
      return 'Beijing University';
    case '3':
      return 'Zhejiang University';
    default:
      return '';
  }
};

async function getUserSchool(userId: string): Promise<string> {
  console.log('call', userId);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(userSchool(userId));
    }, 1000);
  });
}

export default () => {
  const [userId, setUserId] = useState('1');
  const [ready, setReady] = useState(false);

  const { data, loading } = useRequest((uid) => getUserSchool(userId, uid), {
    refreshDeps: [userId],
    ready,
    defaultParams: [{ aaa: 33 }],
  });

  return (
    <div>
      <select
        onChange={(e) => setUserId(e.target.value)}
        value={userId}
        style={{ marginBottom: 16, width: 120 }}
      >
        <option value="1">user 1</option>
        <option value="2">user 2</option>
        <option value="3">user 3</option>
      </select>
      <button
        onClick={() => {
          setReady(true);
          setUserId('2');
        }}
      >
        onCLick
      </button>
      <p>School: {loading ? 'Loading' : data}</p>
    </div>
  );
};
