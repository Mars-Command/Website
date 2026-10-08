import { useEffect, useState } from "react";
import { accountApi, errorMessage } from "../services/accountApi";
import type { User } from "../types/account";

export function useSession() {
	const [user, setUser] = useState<User | null>(null);
	const [completedAttempt, setCompletedAttempt] = useState(-1);
	const [error, setError] = useState("");
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let active = true;
		accountApi.session().then(result => {
			if (active) setUser(result);
		}).catch(error => {
			if (active) setError(errorMessage(error));
		}).finally(() => {
			if (active) setCompletedAttempt(attempt);
		});
		return () => { active = false; };
	}, [attempt]);
	return { user, setUser, loading: completedAttempt !== attempt, error, retry: () => {
		setError("");
		setAttempt(value => value + 1);
	} };
}
