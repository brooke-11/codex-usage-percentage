# Codex 剩余额度百分比补丁

一个非官方的 macOS Codex 桌面端补丁：在左下角账户行右侧显示周额度剩余百分比，例如 `99%`。

它直接复用 Codex 已有的额度状态，不会启动额外进程，也不会自行发送网络请求。Codex 位于前台时，原生额度状态通常每分钟刷新；重新聚焦窗口时也会刷新。

## 实际效果

<img width="262" height="47" alt="codex-light" src="https://github.com/user-attachments/assets/281a82b5-37dc-49a8-8070-d7621f00e141" />
<img width="269" height="54" alt="codex-dark" src="https://github.com/user-attachments/assets/a318bee6-1668-44ad-b473-9c70b6637b3d" />

> [!WARNING]
> 该工具会修改本机 Codex 应用资源，并可能使原有代码签名失效；它不隶属于 OpenAI，也未获得 OpenAI 官方支持。Codex 更新可能覆盖补丁。请仅在理解风险并保留备份的前提下使用。

## 支持范围

- macOS
- 已验证：Codex `26.727.51351`（build `6119`）
- 保留兼容：Codex `26.721.81911`（build `5973`）
- Node.js `22.12.0` 或更高版本

补丁不再绑定单一版本号，而是自动寻找账户栏、额度数据和渲染位置的完整结构。只有恰好一个已知结构家族完整匹配时才会继续；找不到、只匹配一部分或出现多个候选都会停止。因此普通资源改名和压缩变量改名通常不再需要单独适配，但 Codex 真正重做账户栏时仍需更新本工具。

## 安装

```bash
git clone https://github.com/brooke-11/codex-usage-percentage.git
cd codex-usage-percentage
npm ci --ignore-scripts
```

先执行只读检查。该命令仅在临时目录生成候选安装包：

```bash
npm run dry-run
```

完全退出 Codex 后应用补丁：

```bash
npm run apply
```

如果桌面环境会在退出后立即重新启动 Codex，可在只读检查通过后使用原子替换模式：

```bash
npm run apply-live
```

该模式仍会先创建备份、验证候选包，并在安装后检查补丁标记。完成后需要重启 Codex。

原始文件会备份到：

```text
~/Library/Application Support/Codex Usage Percentage Patch/<版本号>-<build>/
```

## 恢复

完全退出 Codex 后运行：

```bash
npm run restore
```

恢复时会校验备份版本和文件摘要。Codex 更新会覆盖补丁；更新后应先重新执行 `npm run dry-run`，只有结构检查通过才重新应用。

## 安全设计

- 修改前要求一个且仅一个完整的账户栏结构家族匹配。
- 自动发现当前版本的渲染资源，不依赖每次变化的文件名。
- 候选包在临时目录生成，并校验结构家族、补丁标记、文件摘要及文件清单。
- 首次安装前保存原始 `app.asar` 和外置资源目录。
- 每个 Codex build 使用独立备份和安装摘要。
- 安装后再次读取磁盘验收；任何摘要不一致都会自动恢复原文件。
- 不读取或上传对话、账号凭据及其他个人数据。

## AI 协作说明

本项目由 [brooke-11](https://github.com/brooke-11) 发起，并在 [OpenAI Codex](https://github.com/codex) 协助下完成设计、实现、安全检查与文档整理。

## License

本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE)。

源码可以查看、学习、修改，并用于非商业项目。任何商业使用均须事先获得项目作者的单独书面许可。
