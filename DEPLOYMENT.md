# Deployment

## IIS as a reverse proxy to SITMUN Application Stack

Below is a general, step-by-step guide for configuring IIS (Internet Information Services) to act as a reverse proxy to SITMUN Application Stack (running either on the same machine or a separate server). The main tool you’ll need is Microsoft’s Application Request Routing (ARR) and the URL Rewrite module.

### Prerequisites

- **[Application Request Routing (ARR)](https://learn.microsoft.com/en-us/iis/extensions/planning-for-arr/application-request-routing-version-2-overview) Installed**. You can install ARR using the Web Platform Installer or by downloading from Microsoft’s website. ARR includes reverse proxy functionality.
- **[URL Rewrite](https://learn.microsoft.com/en-us/iis/extensions/url-rewrite-module/using-the-url-rewrite-module) Installed**. You can also install the URL Rewrite module via the Web Platform Installer or from Microsoft’s website.
- **SITMUN Application Stack Running**. Make sure your SITMUN Application Stack is up and running (on another port on the same machine, or on another server). The typical default port for SITMUN Application Stack is port 9000.

### Scenarios

- **Scenario 1**: SITMUN Application Stack will have a domain name (e.g. `sitmun3.example.com`), and IIS will act as a reverse proxy to the SITMUN Application Stack.
Configure the SITMUN Application Stack `.env` file. For example, if the domain is, say, `sitmun3.example.com` and IIS supports HTTPS requests, the `.env` file should look like this:

```properties
PUBLIC_URL_SCHEME=https
PUBLIC_HOSTNAME=sitmun3.example.com
PUBLIC_PORT=
# PUBLIC_NON_STANDARD_PORT=1
PUBLIC_BASE_PATH=/
```

- **Scenario 2**: SITMUN Application Stack will not have a domain name (e.g. `https://example.com/sitmun3/`), and IIS will act as a reverse proxy to the SITMUN Application Stack.
Configure the SITMUN Application Stack `.env` file. For example, if the domain is, say, `example.com`, IIS supports HTTPS requests and the path is `/sitmun3/`, the `.env` file should look like this:

```properties
PUBLIC_URL_SCHEME=https
PUBLIC_HOSTNAME=example.com
PUBLIC_PORT= 
# PUBLIC_NON_STANDARD_PORT=1
PUBLIC_BASE_PATH=/sitmun3/
```

### Enable and Configure Application Request Routing (ARR) in IIS

1. **Open IIS Manager**.
2. In the left pane (**Connections**), click on the **server level*** (the top node).
3. In the middle pane, double-click **Application Request Routing Cache**.
4. In the right pane (**Action**s), select **Server Proxy Settings**.
5. Check **Enable Proxy**.
6. (Optional) Enable **Preserve client IP** (X-Forwarded-For) if needed.
7. Click **Apply**.

**Official reference** for configuring ARR as a proxy: [Creating a Forward Proxy Using Application Request Routing](https://learn.microsoft.com/en-us/iis/extensions/configuring-application-request-routing-arr/creating-a-forward-proxy-using-application-request-routing)

### Create the Reverse Proxy Rule Using URL Rewrite

1. In IIS Manager, at the same level (server or specific site), double-click **URL Rewrite**.
2. In the right pane (**Actions**), click **Add Rule(s)**.
3. Choose **Blank Rule** (under **Inbound rules**) and click **OK**.

#### Define the Match URL Pattern

In the **Edit Inbound Rule** dialog box, enter **`Reverse Proxy to SITMUN`** for **Name**.
Under the **Match URL** area, enter the following:

- Requested URL: **Matches the Pattern**
- Using: **Wildcards**
- Pattern:
  - **Scenario 1**: `*`
  - **Scenario 2**: To map the requests for, say, `https://example.com/sitmun3/`, use the pattern `^sitmun3/(.*)$`.
- Ignore case: Checked

In the **Scenario 2**, add a second inbound rule route that matches `https://example.com/sitmun3` with the pattern `^sitmun3/(.*)$`.

#### Configure the action

We want to rewrite the URL to the SITMUN Application Stack. We assume for the example that the SITMUN Application Stack is running on `http://localhost:9000/`.

Scroll down to the **Conditions** area of the **Edit Inbound Rule** dialog box, and then click **Add...**.
In the **Add Condition** dialog box, enter the following:

- Action: **Rewrite**
- Rewrite URL: `http://localhost:9000/{R:0}`
- Append query string: Checked

### Test the Setup

In a web browser, test if everything is set correctly. you should see the content that SITMUN Application Stack is serving.

If it doesn’t work, check:

- The host and port SITMUN Application Stack is listening on.
- The firewall rules (if any).
- The syntax of your URL Rewrite rule.
