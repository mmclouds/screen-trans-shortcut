const express = require('express');
const bodyParser = require('body-parser');
const sharp = require('sharp');
const axios = require('axios');
const VolcEngineSDK = require("volcengine-sdk");
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '20mb' }));

app.post('/', async (req, res) => {
  try {
    const { message, password } = req.body;
    console.log('password是:', process.env.API_PASSWORD);
    // 验证密码
    if (password !== process.env.API_PASSWORD) {
      return res.status(401).json({ 
        error: '密码错误',
        message: '请提供正确的访问密码' 
      });
    }

    const { ApiInfo, ServiceInfo, Credentials, API, Request } = VolcEngineSDK;
    const compressedImage = await compressImage(message, 70);
    console.log('原始图片大小:', (message.length / 1024).toFixed(2) + ' KB');
    console.log('原始图片压缩后大小:', (compressedImage.length / 1024).toFixed(2) + ' KB');
    console.log('原始图片压缩率:', (100 - (compressedImage.length / message.length * 100)).toFixed(2) + '%');

    const body = new Request.Body({
      'TargetLanguage': process.env.TARGET_LANGUAGE,
      'Image': compressedImage
    });

    const credentials = new Credentials(
      process.env.VOLC_ACCESS_KEY,
      process.env.VOLC_SECRET_KEY,
      'translate',
      'cn-north-1'
    );

    const query = new Request.Query({
      'Action': 'TranslateImage',
      'Version': '2020-07-01'
    });
    const header = new Request.Header({
      'Content-Type': 'application/json'
    });
    const serviceInfo = new ServiceInfo(
      'open.volcengineapi.com',
      header,
      credentials
    );
    const apiInfo = new ApiInfo('POST', '/', query, body);
    const api = API(serviceInfo, apiInfo);
    const axiosResponse = await axios.post(api.url, api.params, api.config);
    
    console.log('翻译后图片大小:', (axiosResponse.data.Image.length / 1024).toFixed(2) + ' KB');

    const resImage = `data:image/jpeg;base64,${axiosResponse.data.Image}`;
    res.status(200).json({ 
      message: resImage
    });
  } catch (error) {
    console.error('处理请求时出错:', error);
    res.status(500).json({ error: error.message });
  }
});

async function compressImage(base64String, quality) {
  const inputBuffer = Buffer.from(base64String, 'base64');
  const outputBuffer = await sharp(inputBuffer)
    .grayscale()
    .jpeg({
      quality: quality || 85,  // 设置JPEG压缩质量，范围0-100，值越小文件越小，但质量越差
      chromaSubsampling: '4:2:0',  // 色度子采样，4:2:0表示在保持亮度的同时减少色彩信息，可以减少30-40%的文件大小
    })
    .resize(1200, 1200, {
      fit: 'inside',  // 保持纵横比缩放，确保图片完全适应指定的尺寸
      withoutEnlargement: true,  // 防止图片被放大，如果原图小于目标尺寸则保持原始大小
    })
    .normalize()  // 标准化像素值，增强对比度并改善图像的整体外观
    .modulate({
      saturation: 0.8,  // 降低颜色饱和度到原来的80%，减少色彩信息。范围0-1，1为原始饱和度
      brightness: 1.0,  // 保持原始亮度
      hue: 0  // 保持原始色相
    })
    .toBuffer();
  const compressedBase64 = outputBuffer.toString('base64');
  return compressedBase64;
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
