import { window } from "vscode";

// 统一日志通道：VS Code「输出」面板选 Mathis 可看，同时落盘到 logs/<会话>/window*/exthost/output_logging_*/
export const log = window.createOutputChannel("Mathis");
