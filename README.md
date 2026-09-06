# Mathis

一个辅助国际化显示的 vscode 插件

- 定义位置与应用位置的相互跳转
- 支持 next-intl 命名空间写法：`const t = useTranslations("agent")` + `t("title")` 解析为完整 key `agent.title`；定义文件支持嵌套 JSON（自动展平为 `a.b.c`）

![](https://github.com/cheapCoder/mathis/blob/develop/img/intro.gif?raw=true)

- 从剪切板搜索(cmd+shift+v)

![](https://github.com/cheapCoder/mathis/blob/develop/img/search.gif?raw=true)

- 生成字段使用报告(使用 vscode 命令`generate the locale using report`)

![](https://github.com/cheapCoder/mathis/blob/develop/img/report.png?raw=true)

### TODO

- [x] 从应用点 hover 显示定义位置及多语言值
- [x] 从定义位置 hover 显示应用列表及应用行文本
- [x] 支持复制
- [x] 快捷键(cmd+shift+v)查找值
- [x] 支持用户设置 locale 路径
- [x] 支持检测未使用或定义不完全的字段
- [ ] def 文件内展示应用还是定义列表
- [x] 生成多语言使用报告
- [x] 请求远程多语言
- [x] 支持 next-intl 命名空间写法与嵌套 JSON 定义文件
- [ ] 支持修改key名字

### Extension Settings

| 设置名          | 类型                                   | 默认值     | 描述                                                                                                   |
| --------------- | -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| define          | { include: string; exclude: string }[] |            | 定义文件包含:[(使用 vscode glob)](https://code.visualstudio.com/api/references/vscode-api#GlobPattern) |
| apply           | { include: string; exclude: string }[] |            | 应用文件包含:[(使用 vscode glob)](https://code.visualstudio.com/api/references/vscode-api#GlobPattern) |
| i18nLib         | auto \| react-intl \| svelte-i18n \| next-intl | auto | i18n 库；auto 按根目录 package.json 识别，根目录不是应用工程时手动指定（改后重载窗口） |
| detectApplyWay  | "reg" \| "split"                       | split      | 检测应用节点的方式<br />reg:正则匹配(会有缺失)); split:分词在 def 中查找(会有多余)<br />项目依赖 next-intl 时忽略此项，按命名空间解析 |
| defSelect       | "key" \| "value" \| "key and value"    | value      | 跳转定义文件时选择字段的哪些部分                                                                       |
| pathSlice       | boolean                                | true       | 显示路径时去除 src 之前的部分                                                                          |
| remoteLocaleENV | develop \| staging \| production       | production | 远程请求多语言的环境                                                                                   |

> "reg"：i18n format 函数正则匹配(由于情形众多无法全部匹配，会有缺失);
>
> "split"：文本使用分号分词，逐个在定义列表中查找的方式确定是否为 i18n key(由于不通过 format 函数名匹配，会有多余);

### Something Else

- 为了简单直接，插件只监听文件的修改(节流 1s)，不监听文件删除，重命名等行为
- 使用定义文件的文件名作为语言显示
- 右下角状态栏显示 `Mathis 索引中` / `Mathis`（就绪）/ `未找到定义文件`；索引完成前 hover 没有结果，大项目要等几秒。点状态栏打开日志
- 定义/应用文件的 glob 和 i18n 库识别都相对**工作区根目录**：要 hover 的工程必须是根目录，或用 `mathis.define / apply / i18nLib` 指到子目录
- 排查问题看「输出」面板的 `Mathis` 通道：有索引统计和每次 hover 的解析结果
- 自测：`demo/next-intl` 是 next-intl 示例工程（`demo/react-intl` 为 react-intl 示例），`npm run test:e2e` 会起真实 VS Code 对它跑 hover 端到端用例；首次会下载 VS Code 到 `.vscode-test/`，设 `MATHIS_VSCODE` 可改用已装的可执行文件；`npm run test:visual` 再进一步，用 Playwright 通过 CDP 接进测试窗口真实移动鼠标，断言 hover 弹层文字并截图到 `.vscode-test/hover-visual.png`
- 所有位置存储 base-one
- 内部借助包转化为 ast 获取位置，因此字段定义文件内不能有语法错误
- next-intl 项目（根 package.json 依赖含 `next-intl`）按 `useTranslations("ns")` / `getTranslations("ns")` 的变量绑定解析 `t("key")` 与 `t.rich/markup/raw/has("key")`，同名变量多次绑定时取调用前最近一次；模板字符串、变量参数等动态 key 不检测，会在报告中被列为未使用

### 工具：

- [ast explorer](https://astexplorer.net/)
