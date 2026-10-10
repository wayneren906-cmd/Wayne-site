import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { verifyOwner } from "@/lib/access";
import Journal from "../journal";
import SiteHeader from "../site-header";
export const dynamic = "force-dynamic";
export const metadata = {title:"管理学习记录",robots:{index:false,follow:false}};
export default async function AdminPage() {
  try {
    await verifyOwner((await headers()).get("cf-access-jwt-assertion"),env);
  } catch (error) {
    const knownReasons = ["管理员登录尚未配置", "Access 团队地址无效", "请先登录管理员账户", "无法验证管理员身份", "Access 公钥无效", "登录凭证无效", "登录凭证已过期或不属于本站", "此账户无权编辑本站"];
    const reason = error instanceof Error && knownReasons.includes(error.message) ? error.message : "身份验证失败";
    return <div className="shell"><SiteHeader active="learning"/><main className="intro"><div><h1>管理员登录</h1><p className="subtitle">管理员验证未通过：{reason}。</p><a className="secondary" href="/learning">返回学习记录</a></div></main></div>;
  }
  return <><div className="shell" style={{paddingTop:16}}><a className="text-button" href="/cdn-cgi/access/logout">退出管理</a></div><Journal signInPath="/admin" apiPath="/api/admin/records"/></>;
}
