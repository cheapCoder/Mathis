import { IntlProvider, FormattedMessage } from "react-intl";
import messages from "./locale";

export default function App() {
	return (
		<IntlProvider locale={locale} messages={messages[locale]}>
			{intl.formatMessage({ id: "time", t: Date.now() })}
			<FormattedMessage id="greeting" />
			<FormattedMessage id="date" values={{ d: Date.now() }} />
		</IntlProvider>
	);
}
