import axios from "axios";

import { Handler, Bot } from "../../dist/app/bot.js";
import { BotMessageEvent } from "../../dist/app/events.js";
import { Message, MessageSegment } from "../../dist/app/messages.js";

// 配置导入
export let config = { cookies: "" };
export function init_config(config_json) {
    config = config_json;
}

// 变量定义
let dashboard: any = {}
let clusterList: any[] = []
let commitID: string = "";
let latestVersion: string = "";

function formatCommas(num: number): string {
    return num.toLocaleString();
}

function formatUnits(value: number): string {
    const mbValue = value / 1024 / 1024;
    const gbValue = mbValue / 1024;
    const tbValue = gbValue / 1024;

    if (tbValue >= 1) {
        return `${tbValue.toFixed(2)} TiB`;
    } else if (tbValue < 1 && gbValue >= 1) {
        return `${gbValue.toFixed(2)} GiB`;
    } else {
        return `${mbValue.toFixed(2)} MiB`;
    }
}

async function fetchData(cookies: string) {
    const headers = {
        "Cookie": cookies
    }

    try {
        const response = await fetch("https://bd.bangbang93.com/openbmclapi/metric/dashboard", {
            method: "GET",
            headers: headers
        })
        const data = await response.json();
        dashboard = data
    } catch (error) {
        console.error("Error fetching data:", error);
    }
    
    try {
        const response = await fetch("https://bd.bangbang93.com/openbmclapi/metric/rank", {
            method: "GET",
            headers: headers
        })
        const data = await response.json();
        clusterList = data
    } catch (error) {
        console.error("Error fetching data:", error);
    }

    try {
        const response = await fetch("https://bd.bangbang93.com/openbmclapi/metric/version", {
            method: "GET",
            headers: headers
        })
        const data = await response.json();
        latestVersion = data.version
        commitID = data._resolved.slice(52, 59)
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

function formatNodeInfo(rank: number, data: any) {
    const messages: string[] = [];
    messages.push(`${data.isEnabled ? "✅" : "❌"}${data.fullSize ? "🌕" : "🌗"} | ${rank} | ${data.name} | ${data.version}${data.version = latestVersion ? "🟢" : "🟠"}`);
    if (data.user && data.sponsor == null) {
        messages.push(`所有者: ${data.user.name} | 赞助商: 无`);
    } else if (data.user == null && data.sponsor != null) {
        messages.push(`赞助商: ${data.sponsor.name}`);
    } else if (data.user != null && data.sponsor != null) {
        messages.push(`所有者: ${data.user.name} | 赞助商: ${data.sponsor.name}`);
    }
    if (data.metric != null) {
        messages.push(`当日流量: ${formatUnits(data.metric.bytes)} | 当日请求数: ${formatCommas(data.metric.hits)} 次`);
    }
    return messages.join("\n");
}

function simpleFormatNodeInfo(rank: number, data: any) {
    const messages: string[] = [];
    if (data.metric == null) {
        data.metric = {
            bytes: 0,
            hits: 0
        }
    }
    messages.push(`${data.isEnabled? "✅" : "❌"} | ${rank} | ${data.name} | ${formatUnits(data.metric.bytes)} | ${formatCommas(data.metric.hits)}`);
    return messages.join("\n");
}

class HandlerParams {
    args: Array<string>
    handler: Handler
    msg: Message
    event: BotMessageEvent
    constructor(
        args: Array<string>,
        handler: Handler,
        msg: Message,
        event: BotMessageEvent
    ) {
        this.args = args;
        this.handler = handler;
        this.msg = msg;
        this.event = event;
    }
}

async function bmcl_handle(args: Array<string>, handler: Handler, msg: Message, event: BotMessageEvent) {
    msg.addMessage(MessageSegment.reply(event.message_id));
    msg.addMessage(MessageSegment.text("OpenBMCLAPI 面板数据 v0.0.1\n"));
    msg.addMessage(MessageSegment.text(`官方版本: ${latestVersion} | 提交 ID: 22cbee0
在线节点数: ${dashboard.currentNodes} 个 | 负载: ${(dashboard.load * 100).toFixed(2)}%
总带宽: ${dashboard.bandwidth}Mbps | 出网带宽: ${dashboard.currentBandwidth.toFixed(2)}Mbps
当日请求: ${formatCommas(dashboard.hits)} 次 | 数据量: ${formatUnits(dashboard.bytes)}
请求时间: ${new Date().toLocaleString()}
数据源: https://bd.bangbang93.com/pages/dashboard`))
    handler.finish(msg);
}

async function brrs_handle(args: Array<string>, handler: Handler, msg: Message, event: BotMessageEvent) {
    msg.addMessage(MessageSegment.reply(event.message_id));
    msg.addMessage(MessageSegment.text("OpenBMCLAPI 面板数据 v0.0.1\n"));
    if (args.length == 0) {
        msg.addMessage(MessageSegment.text("缺少参数，请输入要查询节点的关键词"));
    } else {
        const arg: string = args[0].toLowerCase();
        let matches_with_index: any[] = [];

        for (let i = 0; i < clusterList.length; i++) {
            if (clusterList[i].name.toLowerCase().includes(arg)) {
                matches_with_index.push({ index: i + 1, data: clusterList[i] });
            }
        }

        if (matches_with_index.length === 0) {
            msg.addMessage(MessageSegment.text("很抱歉，未找到匹配的节点"));
        } else if(matches_with_index.length > 0 && matches_with_index.length <= 5) {
            for (let i = 0; i < matches_with_index.length; i++) {
                msg.addMessage(MessageSegment.text(formatNodeInfo(matches_with_index[i].index, matches_with_index[i].data)))
                if (i != matches_with_index.length - 1) {
                    msg.addMessage(MessageSegment.text("\n"))
                }
            }
        } else if (matches_with_index.length > 5 && matches_with_index.length <= 10) {
            for (let i = 0; i < matches_with_index.length; i++) {
                msg.addMessage(MessageSegment.text(simpleFormatNodeInfo(matches_with_index[i].index, matches_with_index[i].data)))
                if (i != matches_with_index.length - 1) {
                    msg.addMessage(MessageSegment.text("\n"))
                }
            }
        } else {
            msg.addMessage(MessageSegment.text(`搜索结果包含 ${matches_with_index.length} 条，请改用更加精确的参数搜索`));
        }
    }
    msg.addMessage(MessageSegment.text(`\n请求时间: ${new Date().toLocaleString()}`))
    handler.finish(msg);
}

async function buan_handle(args: Array<string>, handler: Handler, msg: Message, event: BotMessageEvent) {
    msg.addMessage(MessageSegment.reply(event.message_id));
    msg.addMessage(MessageSegment.text("OpenBMCLAPI 面板数据 v0.0.1\n"));
    if (args.length == 0) {
        msg.addMessage(MessageSegment.text("缺少参数，请输入节点管理者用户名"));
    } else {
        const arg: string = args[0].toLowerCase();

        const matches_with_index = clusterList
            .map((data, index) => ({ index: index + 1, data }))
            .filter(({ data }) => data.user.name.toLowerCase().includes(arg));

        if (matches_with_index.length === 0) {
            msg.addMessage(MessageSegment.text("很抱歉，未找到匹配的节点"));
        } else {
            let total_bytes: number = 0;
            let total_hits: number = 0;
            for (let i = 0; i < matches_with_index.length; i++) {
                if (matches_with_index[i].data.metric == null) {
                    matches_with_index[i].data.metric = {
                        bytes: 0,
                        hits: 0
                    } 
                }
                total_bytes += matches_with_index[i].data.metric.bytes;
                total_hits += matches_with_index[i].data.metric.hits;
            }
            msg.addMessage(MessageSegment.text(`所有者: ${args[0]} | 节点数量: ${matches_with_index.length}\n当日总流量: ${formatUnits(total_bytes)} | 当日请求数: ${formatCommas(total_hits)}`));
        }
    }
    msg.addMessage(MessageSegment.text(`\n请求时间: ${new Date().toLocaleString()}`))
    handler.finish(msg);
}

async function burank_handle(params: HandlerParams) {
    let data: {
        [username: string]: {
            bytes: number;
            hits: number;
            count: number
        }
    } = {}
    for (let cluster of clusterList) {
        let username = cluster.user.name;
        let metric = cluster.metric || {
            bytes: 0,
            hits: 0
        }
        if (data[username] == null) {
            data[username] = {
                bytes: 0,
                hits: 0,
                count: 0
            }
        }
        data[username].bytes += metric.bytes;
        data[username].hits += metric.hits;
        data[username].count += 1;
    }
    Object.entries(data).sort((a, b) => b[1].bytes - a[1].bytes).forEach((([user, metric]) => {
        params.msg.addMessage(MessageSegment.text(`所有者: ${user} | 节点数量: ${metric.count}\n当日总流量: ${formatUnits(metric.bytes)} | 当日请求数: ${formatCommas(metric.hits)}`));
    }))


}

async function bot_command(
    bot: Bot,
    cmd: string,
    desc: string,
    handler: Handler,
) {
    bot.command(cmd, desc, async (args: Array<string>, handle: Handler, msg: Message, event: BotMessageEvent) => {
        var params = new HandlerParams(
            args,
            handle,
            msg,
            event
        )
        msg.addMessage(MessageSegment.reply(event.message_id));
        msg.addMessage(MessageSegment.text("OpenBMCLAPI 面板数据 v0.0.1\n"));
        await handler(params);
        msg.addMessage(MessageSegment.text(`\n请求时间: ${new Date().toLocaleString()}`))
        handler.finish(msg);
    })
}

export function init(bot: Bot) {
    bot.command("bmcl", "查询 OpenBMCLAPI 面板数据", bmcl_handle);
    bot.command("brrs", "查询 OpenBMCLAPI 某个节点的信息", brrs_handle);
    bot.command("buan", "查询某个用户所有节点的统计", buan_handle);

    bot_command(bot, "burank", "查询 OpenBMCLAPI 某个用户节点排行的信息", burank_handle)

    fetchData(config.cookies);

    setInterval(() => {
        fetchData(config.cookies);
    }, 30000);
}