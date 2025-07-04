# Firecrawl 轻量版开发文档

## 项目概述

基于 Playwright + Readability + Turndown 技术栈，实现一个轻量级的网页内容提取和 Markdown 转换工具，类似 Firecrawl 的核心功能。

## 技术栈

### 核心依赖
- **Playwright** - 浏览器自动化和页面渲染
- **@mozilla/readability** - 智能内容提取算法
- **turndown** - HTML 到 Markdown 转换
- **Express.js** - Web 服务框架
- **Redis** - 缓存和任务队列
- **Bull** - 任务队列管理

### 辅助依赖
- **axios** - HTTP 客户端
- **cheerio** - 服务器端 jQuery（备用方案）
- **helmet** - 安全中间件
- **rate-limiter-flexible** - 请求限流
- **winston** - 日志管理
- **joi** - 数据验证

## 项目结构

```
firecrawl-lite/
├── src/
│   ├── core/
│   │   ├── browser-pool.js      # 浏览器池管理
│   │   ├── extractor.js         # 内容提取器
│   │   ├── converter.js         # Markdown 转换器
│   │   └── cache.js             # 缓存管理
│   ├── services/
│   │   ├── crawler.service.js   # 爬虫服务
│   │   ├── queue.service.js     # 队列服务
│   │   └── storage.service.js   # 存储服务
│   ├── routes/
│   │   ├── extract.js           # 提取接口
│   │   ├── batch.js             # 批量处理接口
│   │   └── status.js            # 状态查询接口
│   ├── middleware/
│   │   ├── auth.js              # 认证中间件
│   │   ├── rate-limit.js        # 限流中间件
│   │   └── validation.js        # 参数验证
│   ├── utils/
│   │   ├── logger.js            # 日志工具
│   │   ├── config.js            # 配置管理
│   │   └── helpers.js           # 辅助函数
│   └── app.js                   # 应用入口
├── config/
│   ├── development.json
│   ├── production.json
│   └── test.json
├── tests/
├── docker/
├── docs/
└── package.json
```

## 核心功能模块

### 1. 浏览器池管理 (BrowserPool)

**功能职责：**
- 管理多个 Playwright 浏览器实例
- 提供浏览器实例的获取和释放
- 监控浏览器健康状态
- 自动重启异常实例

**关键特性：**
- 池大小配置（默认 5 个实例）
- 实例复用机制
- 内存泄漏防护
- 优雅关闭处理

### 2. 内容提取器 (ContentExtractor)

**功能职责：**
- 页面渲染和等待
- 反爬虫检测处理
- Readability 算法应用
- 内容清理和过滤

**处理流程：**
1. 页面导航和渲染
2. 等待内容加载完成
3. 注入 Readability 脚本
4. 提取主要内容
5. 清理无用元素

### 3. Markdown 转换器 (MarkdownConverter)

**功能职责：**
- HTML 到 Markdown 转换
- 格式优化和美化
- 自定义转换规则
- 链接和图片处理

**转换规则：**
- 保持代码块格式
- 优化表格结构
- 处理嵌套列表
- 保留重要属性

### 4. 缓存管理 (CacheManager)

**功能职责：**
- 结果缓存存储
- 缓存失效策略
- 内存和 Redis 双层缓存
- 缓存命中率统计

## API 接口设计

### 单页面提取

```http
POST /api/extract
Content-Type: application/json

{
  "url": "https://example.com/article",
  "options": {
    "includeImages": true,
    "waitForSelector": ".content",
    "timeout": 30000,
    "format": "markdown"
  }
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com/article",
    "title": "文章标题",
    "markdown": "# 文章标题\n\n文章内容...",
    "metadata": {
      "author": "作者",
      "publishDate": "2024-01-01",
      "wordCount": 1500,
      "readingTime": "5 min"
    },
    "extractedAt": "2024-01-01T12:00:00Z"
  }
}
```

### 批量提取

```http
POST /api/batch
Content-Type: application/json

{
  "urls": [
    "https://example.com/article1",
    "https://example.com/article2"
  ],
  "options": {
    "concurrent": 3,
    "includeImages": false
  }
}
```

### 任务状态查询

```http
GET /api/status/{taskId}
```

## 配置选项

### 浏览器配置
```json
{
  "browser": {
    "headless": true,
    "poolSize": 5,
    "timeout": 30000,
    "userAgent": "Mozilla/5.0...",
    "viewport": {
      "width": 1280,
      "height": 720
    }
  }
}
```

### 提取配置
```json
{
  "extraction": {
    "waitForSelector": null,
    "waitTime": 2000,
    "includeImages": true,
    "includeLinks": true,
    "maxContentLength": 1000000
  }
}
```

### 缓存配置
```json
{
  "cache": {
    "ttl": 3600,
    "maxSize": "100mb",
    "redis": {
      "host": "localhost",
      "port": 6379
    }
  }
}
```

## 实现步骤

### 阶段一：基础框架搭建
1. **项目初始化**
   - 创建项目结构
   - 安装核心依赖
   - 配置开发环境

2. **核心模块开发**
   - 实现浏览器池管理
   - 开发基础提取器
   - 集成 Turndown 转换器

3. **基础 API**
   - 实现单页面提取接口
   - 添加基础错误处理
   - 配置日志系统

### 阶段二：功能完善
1. **高级特性**
   - 集成 Readability 算法
   - 添加缓存机制
   - 实现请求限流

2. **批量处理**
   - 开发任务队列
   - 实现并发控制
   - 添加进度追踪

3. **错误处理**
   - 完善异常捕获
   - 添加重试机制
   - 实现降级策略

### 阶段三：生产优化
1. **性能优化**
   - 内存使用优化
   - 并发性能调优
   - 缓存策略优化

2. **监控告警**
   - 添加性能监控
   - 实现健康检查
   - 配置告警机制

3. **部署准备**
   - Docker 容器化
   - 生产环境配置
   - 部署文档编写

## 关键技术要点

### 反爬虫策略
- 随机 User-Agent 轮换
- 请求头伪装
- 代理 IP 支持
- 请求间隔控制
- 浏览器指纹随机化

### 性能优化
- 浏览器实例复用
- 并发请求控制
- 内存泄漏防护
- 缓存命中率优化
- 连接池管理

### 错误处理
- 网络超时重试
- 页面加载失败处理
- 内容提取异常恢复
- 浏览器崩溃重启
- 优雅降级机制

### 内容质量保证
- Readability 算法调优
- 内容完整性验证
- 格式规范化处理
- 去重和清理
- 元数据提取

## 部署架构

### 单机部署
```yaml
services:
  app:
    image: firecrawl-lite:latest
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
  
  redis:
    image: redis:alpine
    volumes:
      - redis_data:/data
```

### 集群部署
```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
  
  app:
    image: firecrawl-lite:latest
    deploy:
      replicas: 3
    environment:
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
  
  redis:
    image: redis:alpine
    deploy:
      replicas: 1
```

## 测试策略

### 单元测试
- 浏览器池功能测试
- 内容提取算法测试
- Markdown 转换质量测试
- 缓存机制验证

### 集成测试
- API 接口功能测试
- 端到端流程验证
- 错误场景处理测试
- 性能基准测试

### 压力测试
- 并发请求测试
- 内存泄漏检测
- 长时间运行稳定性
- 边界条件测试

## 监控指标

### 业务指标
- 提取成功率
- 平均响应时间
- 并发处理能力
- 缓存命中率

### 系统指标
- 内存使用率
- CPU 使用率
- 浏览器实例状态
- 任务队列长度

### 告警规则
- 成功率低于 95%
- 响应时间超过 10s
- 内存使用超过 80%
- 错误率超过 5%

## 安全考虑

### 输入验证
- URL 格式验证
- 参数范围检查
- 恶意链接过滤
- 请求大小限制

### 访问控制
- API 密钥认证
- 请求频率限制
- IP 白名单机制
- 用户权限管理

### 数据安全
- 敏感信息过滤
- 内容安全扫描
- 日志脱敏处理
- 缓存数据加密

## 预期性能指标

### 基准性能
- 单页面提取：2-5 秒
- 并发处理：10-20 个/秒
- 内存使用：500MB-1GB
- 成功率：>95%

### 扩展性目标
- 支持 100+ 并发请求
- 处理 10万+ 页面/天
- 99.9% 可用性
- 秒级故障恢复

## 维护和监控

### 日常维护
- 定期清理缓存
- 浏览器版本更新
- 性能监控检查
- 错误日志分析

### 故障处理
- 快速故障定位
- 自动恢复机制
- 降级服务策略
- 数据备份恢复

这个开发文档提供了完整的实现指南，开发团队可以按照文档逐步实现一个生产级的 Firecrawl 轻量版本。