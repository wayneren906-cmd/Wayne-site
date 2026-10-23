import { redirect } from "next/navigation";

// 全站搜索已下线：历史链接直接回到 Studio，不再渲染搜索页。
export default function SearchPage() {
  redirect("/studio");
}
