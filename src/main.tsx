import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CrashBoundary, installGlobalErrorHandlers } from "./crashlog";
import "./styles.css";

installGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<CrashBoundary>
			<App />
		</CrashBoundary>
	</React.StrictMode>,
);
