# Huawei LTE API Command Line Interface

A flexible Python CLI wrapper for the `huawei-lte-api` library. This script interacts directly with Huawei 4G/5G mobile routers to fetch device statistics, SMS messages, read network stats, and execute functions like restarting the device.

## Prerequisites

1. Active python environment (virtualenv recommended).
2. Install `huawei-lte-api`:
   ```bash
   pip install huawei-lte-api
   ```
3. A connected Huawei LTE device accessible via an IP address.

## Usage Overview

The script `main_huw.py` performs several remote actions based on the flags provided. Almost all interactions require the `--credentials` flag with a valid `--username` (`-u`) and `--password` (`-p`).

### Basic Command Structure

```bash
python main_huw.py [CONNECTION OPTIONS] [CREDENTIALS] [ACTIONS] [TARGET ARGUMENTS]
```

---

## Command Reference

### Connection & Protocol Options
- `--ip-addr`: The IP Address of the router. (Default: `192.168.8.1`)
- `--protocol`: The connection protocol. You can try a comma-separated fallback list. (e.g. `http` or `https,http`)

### Authentication
- `--credentials`: Required to unlock authenticated actions.
- `-u` / `--username`: The login username for the router (often `admin`).
- `-p` / `--password`: The login password for the router.

### Logging and Error Handling
By default, the script only prints exactly what it is fetching (no extra logs) to make it easy to pipe to `jq` or text files.
- `--verbose`: Shows informational connection logs (INFO tier).
- `--suppress-error`: Hides ERROR traceback logs entirely (useful for quiet pipelines).
- `--exit-to-one-if-error`: Exits the program with error code `1` immediately if an error occurs.

### Action Flags
> All of these require the `--credentials` flag to be set.
- `--network-stats`: Outputs a clean layout of your current active connection, tower info (RSRP, SINR, RSRQ), mobile mode (2G/4G/5G), and an ascii bar chart of signal strength.
- `--device-info`: Dumps JSON diagnostic device info.
- `--dump`: Dumps traffic statistics and current status.
- `--receive-msg`: Pulls up to 20 recent SMS messages from the device inbox.
- `--reboot-router`: Restarts the target router device.
- `--send-msg`: Sends an SMS. Requires auxiliary targets (`-t` / `--target` for Phone Number) and (`-m` / `--message` for Message Body).

---

## Usage Examples

**1. Viewing Signal Strength (Verbose Logging Enabled):**
```bash
python main_huw.py --ip-addr 192.168.8.1 --protocol http --credentials -u admin -p routerpassword --network-stats --verbose
```

**2. Fetching Network Statistics Quietly (Only prints results):**
```bash
python main_huw.py --credentials -u admin -p routerpassword --network-stats
```
*Output Format:* 
```text
ProviderName 4G ▂▃▄▅▇
  RSRP: -85dBm
  RSRQ: -13dB
  SINR: 12dB
  IP: 10.x.x.x
```

**3. Sending an SMS Message:**
```bash
python main_huw.py --credentials -u admin -p myrouterpw --send-msg -t "09123456789" -m "Hello from CLI!" --verbose
```

**4. Reading Received SMS Messages:**
```bash
python main_huw.py --credentials -u admin -p myrouterpw --receive-msg
```

**5. Protocol Fallback Checking & Rebooting:**
*If you are unsure if the router supports HTTPS, you can instruct the script to try HTTPS first and fallback safely to HTTP if unsuccessful.*
```bash
python main_huw.py --protocol https,http --credentials -u admin -p myrouterpw --reboot-router --verbose
```
