(() => {
  const SESSION_KEY = "koala-ledger:agentation-session-id";
  const ENDPOINT_KEY = "koala-ledger:agentation-endpoint";
  const DEFAULT_ENDPOINT = "http://localhost:4747";
  const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
  const REACT_VERSION = "18.3.1";
  const AGENTATION_VERSION = "3.0.2";

  if (!LOCAL_HOSTS.has(window.location.hostname)) return;

  const endpoint = window.localStorage.getItem(ENDPOINT_KEY) || DEFAULT_ENDPOINT;

  let rootEl = document.getElementById("agentation-dev-root");
  if (!rootEl) {
    rootEl = document.createElement("div");
    rootEl.id = "agentation-dev-root";
    document.body.appendChild(rootEl);
  }

  const reactUrl = `https://esm.sh/react@${REACT_VERSION}?dev`;
  const reactDomUrl = `https://esm.sh/react-dom@${REACT_VERSION}/client?dev`;
  const agentationUrl =
    `https://esm.sh/agentation@${AGENTATION_VERSION}?dev&deps=react@${REACT_VERSION},react-dom@${REACT_VERSION}`;

  Promise.all([
    import(reactUrl),
    import(reactDomUrl),
    import(agentationUrl)
  ])
    .then(([ReactModule, ReactDomClientModule, AgentationModule]) => {
      const React = ReactModule.default;
      const { createRoot } = ReactDomClientModule;
      const { Agentation } = AgentationModule;
      const existingSessionId = window.localStorage.getItem(SESSION_KEY) || undefined;

      createRoot(rootEl).render(
        React.createElement(Agentation, {
          endpoint,
          sessionId: existingSessionId,
          onSessionCreated(sessionId) {
            try {
              window.localStorage.setItem(SESSION_KEY, String(sessionId || ""));
            } catch {}
          }
        })
      );
    })
    .catch((error) => {
      console.error("[koala-ledger] Failed to load Agentation dev overlay.", error);
    });
})();
