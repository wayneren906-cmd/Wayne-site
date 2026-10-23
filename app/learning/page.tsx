import type { Metadata } from "next";
import Journal from "../journal";

export const metadata: Metadata = { title: "学习记录" };
export const dynamic = "force-dynamic";
export default function LearningPage() { return <Journal />; }
