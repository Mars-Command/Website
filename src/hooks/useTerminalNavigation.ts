import { useCallback, useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import { useTerminalMotion } from "./useTerminalMotion";

type Navigation<View extends string> = {
	view: View | null;
	target: View;
	phase: "typing" | "idle" | "clear" | "cat";
	request: number;
	output: number;
};

export function useTerminalNavigation<View extends string>(initialView: View,
	main: RefObject<HTMLElement | null>, prompt: RefObject<HTMLDivElement | null>) {
	const { beginNavigation } = useTerminalMotion();
	const [navigation, setNavigation] = useState<Navigation<View>>({
		view: initialView, target: initialView, phase: "typing", request: 0, output: 0,
	});
	const navigate = useCallback((view: View) => {
		const animate = beginNavigation();
		setNavigation(current => ({
			view: animate ? current.view : view, target: view, phase: animate ? "clear" : "typing",
			request: current.request + 1, output: animate ? current.output : current.request + 1,
		}));
		if (animate) prompt.current?.scrollIntoView({ behavior: "smooth", block: "end" });
	}, [beginNavigation, prompt]);
	const completeCommand = useCallback((phase: "clear" | "cat", request: number) => {
		setNavigation(current => {
			if (current.phase !== phase || current.request !== request) return current;
			return phase === "clear" ? { ...current, view: null, phase: "cat" } :
				{ ...current, view: current.target, output: request, phase: "typing" };
		});
	}, []);
	const completeOutput = useCallback((output: number) => {
		setNavigation(current => current.phase === "typing" && current.output === output ? { ...current, phase: "idle" } : current);
	}, []);
	useLayoutEffect(() => {
		if (navigation.output > 0) {
			main.current?.scrollIntoView({ behavior: "instant", block: "start" });
			main.current?.focus({ preventScroll: true });
		}
	}, [navigation.output, main]);
	return {
		...navigation, navigate, completeCommand, completeOutput,
		transitioning: navigation.phase === "clear" || navigation.phase === "cat",
	};
}
