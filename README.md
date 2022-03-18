# mathis

一个辅助国际化显示的 vscode 小插件

![](https://github.com/cheapCoder/mathis/blob/develop/img/intro.gif?raw=true)

## Features

- [x] 从应用点 hover 显示定义位置及多语言值
- [x] 从定义位置 hover 显示应用列表及应用行文本
- [x] 支持复制值
- [x] 快捷键(cmd+shift+v)或左下角的查找按钮查找值
- [ ] 支持用户设置locale路径
- [ ] 支持检测未使用或定义不完全的字段
- [ ] 添加缓存，减少插件启动时操作
- [ ] def文件内展示应用还是定义列表

## Extension Settings

```jsonc
"mathis.lazyLoadApply": {
	"description": "是否直到进入国际化定义文件才加载字段应用列表",
	"type": "boolean",
	"default": true
},
"mathis.pathSlice": {
	"description": "显示路径时去除src之前的部分",
	"type": "boolean",
	"default": true,
}
"mathis.detectApplyWay": {
	"description": "检测应用节点的方式",
	"type": "string",
	"default": "split",
	"enum": [
		"reg",  // 通过i18n format函数正则匹配(由于情形众多无法全部匹配，会有缺失)
		"split" // 将文本使用分号分词，逐个在定义列表中查找的方式确定是否为i18n key(由于不通过format函数名匹配，会有多余)
	]
},
"mathis.defSelect": {
	"description": "跳转定义文件时选择字段的哪些部分",
	"type": "string",
	"default": "value",
	"enum": [
		"key",
		"value",
		"key and value"
	]
},
```

## Something Else

- 为了简单直接，插件只监听文件的保存(节流 1s)，不监听文件删除，重命名等行为

- 使用定义文件的文件名作为语言显示

- 所有位置存储 base-one

### 工具：

- [ast explorer](https://astexplorer.net/)
