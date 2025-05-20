import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

let cachedToken = null;
let expireAt = 0;

export async function getTenantAccessToken() {
  if (cachedToken && Date.now() < expireAt) {
    return cachedToken;
  }

  try {
    const res = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    });

    if (res.data.code !== 0) {
      throw new Error(`Token fetch failed: ${JSON.stringify(res.data)}`);
    }

    cachedToken = res.data.tenant_access_token;
    expireAt = Date.now() + res.data.expire * 1000 - 60000; // 提前一分钟过期
    return cachedToken;
  } catch (err) {
    throw new Error(`getTenantAccessToken error: ${err.message}`);
  }
}
