# Swagger Integration Documentation

## 🎉 OpenAPI & Swagger UI 已成功集成！

Firecrawl Lite 现在包含完整的 OpenAPI 3.0 规范和交互式 Swagger UI 文档。

## 📖 访问文档

### Swagger UI 界面
- **主要入口**: http://localhost:3000/docs
- **备用入口**: http://localhost:3000/api-docs

### 功能特色
- 🔍 **交互式测试**: 直接在浏览器中测试所有 API 端点
- 📋 **完整规范**: 详细的请求/响应模式和示例
- 🎯 **参数验证**: 实时参数验证和错误提示
- 📊 **响应预览**: 查看实际的 API 响应
- 💾 **持久化**: 保存认证信息和测试参数

## 🚀 快速开始

### 1. 启动服务器
```bash
# 标准启动
npm start

# 开发模式
npm run dev

# 演示模式（包含详细说明）
npm run demo
```

### 2. 访问 Swagger UI
打开浏览器访问: http://localhost:3000/docs

### 3. 测试 API
1. 点击任意端点展开详情
2. 点击 "Try it out" 按钮
3. 填写请求参数
4. 点击 "Execute" 执行请求
5. 查看响应结果

## 📋 可用端点

### 🔍 内容提取
- **POST /api/extract** - 单页面内容提取
- **POST /api/batch** - 批量URL处理

### 🏥 健康检查
- **GET /api/health** - 通用健康检查
- **GET /api/extract/health** - 服务健康检查

### 📊 统计信息
- **GET /api/extract/stats** - 服务性能统计

### 📄 信息端点
- **GET /** - API 基本信息

## 🎯 测试示例

### 单页面提取示例
```json
{
  "url": "https://httpbin.org/html",
  "options": {
    "includeImages": false,
    "includeLinks": true,
    "format": "markdown",
    "timeout": 15000,
    "waitTime": 2000,
    "conversion": {
      "headingStyle": "atx",
      "bulletListMarker": "-"
    }
  }
}
```

### 批量处理示例
```json
{
  "urls": [
    "https://httpbin.org/html",
    "https://example.com"
  ],
  "options": {
    "concurrent": 2,
    "includeImages": false,
    "timeout": 20000,
    "blockResources": ["stylesheet", "font"]
  }
}
```

### 高级配置示例
```json
{
  "url": "https://blog.example.com/article",
  "options": {
    "includeImages": true,
    "includeLinks": true,
    "waitForSelector": ".article-content",
    "timeout": 30000,
    "blockResources": ["media", "font"],
    "headers": {
      "User-Agent": "Mozilla/5.0 Custom Bot"
    },
    "cookies": [
      {
        "name": "session",
        "value": "abc123",
        "domain": "example.com"
      }
    ],
    "conversion": {
      "headingStyle": "atx",
      "bulletListMarker": "*",
      "codeBlockStyle": "fenced",
      "linkStyle": "inlined"
    }
  }
}
```

## 🔧 OpenAPI 规范详情

### 支持的功能
- ✅ 完整的请求/响应模式定义
- ✅ 数据类型验证和约束
- ✅ 示例数据和用例
- ✅ 错误响应规范
- ✅ 参数描述和默认值
- ✅ 标签分组和组织
- ✅ 安全策略（为未来扩展预留）

### 模式组件
- **ExtractRequest** - 单页面提取请求
- **BatchRequest** - 批量处理请求
- **ExtractResponse** - 提取成功响应
- **BatchResponse** - 批量处理响应
- **HealthResponse** - 健康检查响应
- **StatsResponse** - 统计信息响应
- **ErrorResponse** - 错误响应
- **ValidationError** - 参数验证错误

## 🎨 自定义配置

### Swagger UI 主题
已配置自定义样式：
- 隐藏顶部栏
- 优化信息区域间距
- 自定义标题颜色
- 响应式设计

### 安全配置
已调整 CSP 策略以支持 Swagger UI：
- 允许内联样式和脚本
- 支持外部字体资源
- 允许数据 URI 图片

## 🧪 测试脚本

### 可用测试命令
```bash
# 测试 API 功能
npm run test:api

# 测试 Swagger 集成
npm run test:swagger

# 运行演示
npm run demo
```

### 自动化测试
所有测试脚本都会验证：
- 服务器启动状态
- 端点可访问性
- Swagger UI 可用性
- API 响应正确性

## 🚀 部署考虑

### 生产环境
在生产环境中，Swagger UI 仍然可用，但建议：
- 考虑是否需要公开 API 文档
- 配置适当的访问控制
- 更新服务器 URL 配置

### Docker 支持
Swagger UI 已集成到 Docker 配置中：
```bash
docker-compose up -d
# 访问: http://localhost:3000/docs
```

## 📝 维护说明

### 更新 API 文档
1. 在路由文件中添加 JSDoc 注释
2. 更新 `src/docs/swagger.js` 中的模式定义
3. 重启服务器以反映更改

### 添加新端点
1. 在路由文件中定义端点
2. 添加相应的 Swagger 注释
3. 更新模式定义（如需要）
4. 测试文档更新

## 🎉 总结

Swagger 集成为 Firecrawl Lite 提供了：
- 📖 **专业的 API 文档**
- 🧪 **交互式测试环境**
- 🔍 **完整的规范定义**
- 🚀 **开发者友好的体验**

现在你可以通过访问 `/docs` 直接在浏览器中测试所有 API 功能！