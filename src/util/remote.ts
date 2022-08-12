import { get } from "https";

interface remoteReqParams {
	app: string;
	locale: string;
	env: "develop" | "staging" | "production";
}

const COB_SERVICE_URL_MAPPING = {
	develop: "https://cob.dev.shoplazza.com",
	staging: "https://cob.stg.shoplazza.com",
	production: "https://cob.shoplazza.com",
};

const getAppLocaleURL = async ({ app, locale, env }: remoteReqParams): Promise<string> => {
	const url = COB_SERVICE_URL_MAPPING[env];

	const response = await req(`${url}/api/i18n?app=${app}&locale=${locale}`);
	return response[app];
};

export const getAppLocaleMessages = async ({
	app,
	locale,
	env,
}: remoteReqParams): Promise<Record<string, string> | null> => {
	const url = await getAppLocaleURL({ app, locale, env });
	if (!url) return null;
	const response = await req(`https://assets.shoplazza.com/${url}`);
	return response;
};

async function req(link: string): Promise<Record<string, string>> {
	return new Promise<Record<string, string>>(resolve => {
		get(link, res => {
			let body = "";

			res.on("data", chunk => {
				body += chunk;
			});

			res.on("end", () => {
				try {
					let json = JSON.parse(body);
					resolve(json);
				} catch (error) {
					resolve({});
				}
			});
		}).on("error", () => {
			resolve({});
		});
	});
}
