"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type PlanLayerType from "./PlanLayer";
const PlanLayer = dynamic(() => import("./PlanLayer"), { ssr: false });
export default function PlanLayerLoader(props: ComponentProps<typeof PlanLayerType>) { return <PlanLayer {...props} />; }
