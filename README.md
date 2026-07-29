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
- Codex `26.721.81911`（build `5973`）
- Node.js `22.12.0` 或更高版本

补丁会校验 Codex 版本、完整安装包摘要及目标渲染文件摘要。任何一项不一致都会停止，不会尝试修改未知版本。

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
~/Library/Application Support/Codex Usage Percentage Patch/26.721.81911-5973/
```

## 恢复

完全退出 Codex 后运行：

```bash
npm run restore
```

恢复时会校验备份版本和文件摘要。Codex 升级后不要直接重复使用旧补丁，应为新版本重新生成并验证补丁。

## 安全设计

- 修改前严格校验目标版本和文件摘要。
- 候选包在临时目录生成，并校验补丁标记及文件清单。
- 首次安装前保存原始 `app.asar` 和外置资源目录。
- 安装后再次读取磁盘验收；失败时自动恢复原文件。
- 不读取或上传对话、账号凭据及其他个人数据。

## AI 协作说明

本项目由 [brooke-11](https://github.com/brooke-11) 发起，并在 [OpenAI Codex](https://github.com/codex) 协助下完成设计、实现、安全检查与文档整理。

## License

[MIT](LICENSE)
