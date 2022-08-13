# Mathis

## hover show value

一个辅助国际化显示的 vscode 插件

- 定义位置与应用位置的相互跳转

![](https://github.com/cheapCoder/mathis/blob/develop/img/intro.gif?raw=true)

- 从剪切板搜索(cmd+shift+v)

![](https://github.com/cheapCoder/mathis/blob/develop/img/search.gif?raw=true)

- 生成字段使用报告(使用 vscode 命令`generate the locale using report`)

![](https://github.com/cheapCoder/mathis/blob/develop/img/report.png?raw=true)

### Features

- [x] 从应用点 hover 显示定义位置及多语言值
- [x] 从定义位置 hover 显示应用列表及应用行文本
- [x] 支持复制值
- [x] 快捷键(cmd+shift+v)或左下角的查找按钮查找值
- [x] 支持用户设置 locale 路径
- [x] 支持检测未使用或定义不完全的字段
- [ ] 支持多工作区
- [ ] def 文件内展示应用还是定义列表
- [x] 生成多语言使用报告
- [x] 请求远程多语言

### Extension Settings

| 设置名           | 类型                                | 默认值                                                                                 | 描述                                                                                                   |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| defIncludeGlob   | string[]                            | ["src/**/locale/*.{ts,js,json}", "node_modules/shoplazza-sdk/es/shoplazza-app/locale"] | 定义文件包含:[(使用 vscode glob)](https://code.visualstudio.com/api/references/vscode-api#GlobPattern) |
| applyIncludeGlob | string[]                            | ["src/\*_/_.{ts,js,tsx,jsx,svelte,vue}"]                                               | 应用文件包含:[(使用 vscode glob)](https://code.visualstudio.com/api/references/vscode-api#GlobPattern) |
| detectApplyWay   | "reg" \| "split"                    | split                                                                                  | 检测应用节点的方式<br />reg:正则匹配(会有缺失)); split:分词在 def 中查找(会有多余)                     |
| defSelect        | "key" \| "value" \| "key and value" | value                                                                                  | 跳转定义文件时选择字段的哪些部分                                                                       |
| pathSlice        | boolean                             | true                                                                                   | 显示路径时去除 src 之前的部分                                                                          |
| statusBar        | boolean                             | true                                                                                   | 在左下方显示查找按钮,其行为与 cmd+shift+v 相同                                                         |
| remoteLocaleENV  | develop \| staging \| production    | production                                                                             | 远程请求多语言的环境                                                                                   |

> "reg"：i18n format 函数正则匹配(由于情形众多无法全部匹配，会有缺失);
>
> "split"：文本使用分号分词，逐个在定义列表中查找的方式确定是否为 i18n key(由于不通过 format 函数名匹配，会有多余);

### Something Else

- 为了简单直接，插件只监听文件的修改(节流 1s)，不监听文件删除，重命名等行为
- 使用定义文件的文件名作为语言显示
- 所有位置存储 base-one
- 内部借助包转化为 ast 获取位置，因此字段定义文件内不能有语法错误

## For css token replace

按`f1`显示所有命令，搜索`replace all css value using my css design token`并确定，即会尝试替换 css 值为对应 css 变量。

![](https://github.com/cheapCoder/mathis/blob/develop/img/replace.gif?raw=true)

| 设置名          | 类型    | 默认值                                                    | 描述                                                                                                           |
| --------------- | ------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| useTokenReplace | boolean | false                                                     | 是否开启主题升级功能                                                                                           |
| tokenLink       | string  | https://assets.shoplazza.com/sds/0.1.62/design-tokens.css | 主题升级的 css 链接                                                                                            |
| includeGlob     | string  | src/\*_/_.{css,less,sass,scss}                            | 主题升级涉及文件包含:[(使用 vscode glob)](https://code.visualstudio.com/api/references/vscode-api#GlobPattern) |
| excludeGlob     | string  | **/{node_modules,dist,out,test}/**                        | 主题升级涉及文件排除:[(使用 vscode glob)](https://code.visualstudio.com/api/references/vscode-api#GlobPattern) |

#### tokenLink 内的注释标记

- `/* @use(color | font) */`用于插件替换哪些 css 为对应 token，表示用于哪些 css(includes 即可)，`|`分割属性。
- `/* @ignore */`：忽略下方属性

#### token 处理方式

1. 当存在一个 css 变量对应时，会直接替换(建议在 git 里检查)
2. 当不存在 css 变量对应时，会添加`warn提示`(黄色波浪底线和弃用横线)

![](https://github.com/cheapCoder/mathis/blob/develop/img/warn_color.png?raw=true)

3. 当存在多个 css 变量对应时，会添加`info提示`(蓝色波浪底线)。在光标聚焦后,可通过 hover 的`快速修复...`选择替换哪个 css 变量，或者用快捷键`cmd+.`选择

![](https://github.com/cheapCoder/mathis/blob/develop/img/info_color.png?raw=true)

![](https://github.com/cheapCoder/mathis/blob/develop/img/replace.png?raw=true)

> `info提示`也可在`问题`中快速选择替换哪个变量，详情见 gif

### 工具：

- [ast explorer](https://astexplorer.net/)
