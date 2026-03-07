import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const gitConfig = {
	user: "kareemschultz",
	repo: "Bettencourt-POS",
	branch: "master",
};

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			title: "Bettencourt's POS",
		},
		githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
	};
}
