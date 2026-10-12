# Hive browser account admission

`createHiveLoginApp` supplies login and callback resources for a host's existing browser session. The host supplies its representations, registry, cookies and state directory. The signed challenge binds application, account and nonce; the persisted nonce is consumed once, and valid account-key proof does not bypass the host registry.

This is Hive account admission, not canonical Actor association, Board budget admission, hiring authority or transaction authorization. Signature verification currently checks live key membership across two RPC nodes; it does not establish a general weighted or delegated Hive authority evaluation.

Source recovered from Bare Cedar Fog at c677e9999ea05bf577f9355660687e56dffd3da9. The browser admission demonstration uses a disposable signing key, two fixture RPC responses and an actual temporary nonce file. It exercises refusal of an unadmitted account, admitted session establishment and replay refusal. Live host migration remains unfinished.
