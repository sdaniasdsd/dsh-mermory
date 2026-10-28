# DSH 选择性记忆

面向 DeepSeek Harness 的记忆插件。按研究问题召回相关的结构原语、截断和命题，并可选择性读取已有研究包；不需要仿真，也不需要安装 Python 或运行数据库。

## 安装

在 DSH 的插件页面选择添加插件，输入：

```text
https://github.com/sdaniasdsd/dsh-mermory
```

安装完成后选择“立即启用”（或打开插件开关）。如果安装界面要求包地址格式，使用 `github:sdaniasdsd/dsh-mermory`。CLI 安装到 Web 配置的示例：

```powershell
dsh plugin --profile web add 'github:sdaniasdsd/dsh-mermory'
```

Desktop 版将 `web` 换成 `desktop`。如启用后工具尚未出现，重启 DSH 或新建会话。此包声明 `dsh.bundle`，会注册 `mcp__huozhong_memory__recall_research_memory` 工具和记忆预算插件；模型按问题和工具描述决定是否调用。

## 包含什么

- 内置来自 [planetary-knowledge-base](https://gitee.com/chunyouzhidi/planetary-knowledge-base) 的结构知识快照：6 个原语、9 个截断、2 个命题的关联。采用原有签名字段权重，包括关键区域 2.0、输出要求和失败代价 1.5、反馈可用性 0.5。
- 支持中英文的部分关键词提取，返回结构得分、匹配及冲突字段、关联节点；结果是待复核先验。
- 可选研究包召回：读取用户显式指定的 `manifest.json`，按关键词与时间衰减筛选，保留来源、状态和证据引用。
- 每次请求前检查当前会话中本工具返回的可见内容，超过预算时移除较旧结果；原始会话日志不删除。衰减公式移植自 [Lethe](https://github.com/Fqih/Lethe)，许可证在 `third-party/lethe-LICENSE`。

**范围：**本版本是选择性召回插件，不会自动从对话中提取、写入或更新长期记忆；没有自动跨包语义链接，也不自动执行仿真或验证。模型回答中引用的材料仍需要按其来源和证据等级判断。

## 可选配置

无需配置即可查询内置结构知识。默认按 32768 的上下文窗口计算预算；使用不同模型或部署窗口时，启动 DSH 前设置 `DSH_MEMORY_CONTEXT_TOKENS`。例如：

```powershell
$env:DSH_MEMORY_CONTEXT_TOKENS = '32768'
$env:DSH_MEMORY_MANIFESTS = 'D:\研究包A\manifest.json;D:\研究包B\manifest.json'
dsh web
```

Windows 上多个 manifest 用分号隔开，其他系统用系统路径分隔符。`DSH_MEMORY_USED_TOKENS` 和 `DSH_MEMORY_OUTPUT_TOKENS` 可设定其他输入和输出预留；未设置均为 0。指定不存在或格式错误的文件会返回错误，不会扫描其他文件。若 DSH 是桌面启动，环境变量须在启动进程时可见；不指定 manifest 时只查询内置结构数据。

预算默认以配置窗口的 30% 为上限，同时考虑输入与输出预留。当前按 UTF-8 字节估算，并裁剪该插件的工具结果；它不是模型专用 tokenizer，不能保证实际 token、工具包装或压缩摘要中的记忆严格低于整个上下文的 30%。模型调用会将被召回内容传给所选模型提供方。

## 本地测试

```sh
npm test
```

已在官方 DSH 0.2.1-rc.3 的隔离 Web profile 中安装并使用 DeepSeek-V4.1-Flash 验证自动工具调用。插件代码和内置数据保存在本仓库；原始知识库不在插件运行时被修改。
