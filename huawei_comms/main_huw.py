#!/usr/bin/env python3
import sys
import argparse
import json
import re
import logging
from huawei_lte_api.Client import Client
from huawei_lte_api.Connection import Connection
from huawei_lte_api.AuthorizedConnection import AuthorizedConnection

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

SIGNAL_LEVELS = {
    0: "     ",
    1: "▂    ",
    2: "▂▃   ",
    3: "▂▃▄  ",
    4: "▂▃▄▅ ",
    5: "▂▃▄▅▇",
}

def parse_dbm(value):
    if value is None:
        return None
    match = re.search(r"-?\d+", str(value))
    return int(match.group()) if match else None

def get_signal_level(rsrp):
    if rsrp is None:
        return 0
    if rsrp >= -80:
        return 5
    if rsrp >= -90:
        return 4
    if rsrp >= -100:
        return 3
    if rsrp >= -110:
        return 2
    if rsrp >= -120:
        return 1
    return 0

def main():
    parser = argparse.ArgumentParser(description="Command Line Interface for Huawei LTE API")
    
    # Connection arguments
    parser.add_argument("--ip-addr", default="192.168.8.1", 
                        help="IP address of the router (default: 192.168.8.1)")
    parser.add_argument("--protocol", choices=["http", "https"], default="http", 
                        help="Protocol to use (default: http). Note: https may not work on all routers.")
    
    # Credentials arguments
    parser.add_argument("--credentials", action="store_true", 
                        help="Enable credentials for authentication")
    parser.add_argument("-u", "--username", 
                        help="Username for authentication (used with --credentials)")
    parser.add_argument("-p", "--password", 
                        help="Password for authentication (used with --credentials)")

    # Actions
    parser.add_argument("--dump", action="store_true", 
                        help="Dump general router information (requires --credentials)")
    parser.add_argument("--device-info", action="store_true", 
                        help="Dump detailed device info (requires --credentials)")
    parser.add_argument("--reboot-router", action="store_true", 
                        help="Reboot the router (requires --credentials)")
    parser.add_argument("--receive-msg", action="store_true", 
                        help="Receive SMS messages from inbox (requires --credentials)")
    parser.add_argument("--network-stats", action="store_true", 
                        help="Display 4G/5G modem signal strength & network info (requires --credentials)")
    
    # Send message arguments
    parser.add_argument("--send-msg", action="store_true", 
                        help="Send an SMS message (requires --credentials)")
    parser.add_argument("-t", "--target", 
                        help="Target phone number for sending message")
    parser.add_argument("-m", "--message", 
                        help="Message body to send")

    args = parser.parse_args()

    # Validate credentials arguments
    if args.credentials:
        if not args.username or not args.password:
            parser.error("--credentials requires -u/--username and -p/--password")

    # Define actions that require credentials
    actions_requiring_credentials = ["dump", "device_info", "send_msg", "reboot_router", "receive_msg", "network_stats"]
    
    # Validate actions flag conditions
    any_action = False
    for action in actions_requiring_credentials:
        if getattr(args, action):
            any_action = True
            if not args.credentials:
                parser.error(f"--{action.replace('_', '-')} requires the --credentials flag")
            
    if not any_action:
        parser.print_help()
        sys.exit(0)

    # Validate send message arguments
    if args.send_msg:
        if not args.target or not args.message:
            parser.error("--send-msg requires -t/--target and -m/--message")

    # Build the connection URL
    url = f"{args.protocol}://"
    if args.credentials:
        # URL encode credentials if they contain special chars? Often raw works, but good to note.
        # Format: http://username:password@ip-addr/
        url += f"{args.username}:{args.password}@"
    url += f"{args.ip_addr}/"

    try:
        # Establish connection
        if args.credentials:
            connection = AuthorizedConnection(url)
        else:
            connection = Connection(url)
            
        # Initialize client
        client = Client(connection)
        
        if args.dump:
            logger.info("Dumping router information...")
            try:
                # Dump an aggregate of useful stats
                status = client.monitoring.status()
                traffic = client.monitoring.traffic_statistics()
                
                dump_data = {
                    "status": status,
                    "traffic_statistics": traffic
                }
                print(json.dumps(dump_data, indent=4))
            except Exception as e:
                logger.error(f"Failed to dump router info: {e}")

        if args.device_info:
            logger.info("Fetching device info...")
            try:
                info = client.device.information()
                print(json.dumps(info, indent=4))
            except Exception as e:
                logger.error(f"Failed to fetch device info: {e}")
                
        if args.send_msg:
            logger.info(f"Sending message to {args.target}...")
            try:
                result = client.sms.send_sms(
                    phone_numbers=[args.target],
                    message=args.message
                )
                if result == 'OK':
                    logger.info("Message sent successfully!")
                else:
                    logger.info(f"Send message result: {result}")
            except Exception as e:
                logger.error(f"Failed to send message: {e}")
                
        if args.receive_msg:
            logger.info("Receiving messages from inbox...")
            try:
                # box_type 1 = incoming/inbox
                messages = client.sms.get_sms_list(page=1, qty=20, box_type=1)
                
                if messages and 'Messages' in messages and 'Message' in messages['Messages']:
                    msgs = messages['Messages']['Message']
                    if not isinstance(msgs, list):
                        msgs = [msgs]
                        
                    for msg in msgs:
                        print(f"[{msg.get('Date', 'N/A')}] From: {msg.get('Phone', 'Unknown')} - {msg.get('Content', '')}")
                else:
                    logger.info("No messages found.")
                    
            except Exception as e:
                logger.error(f"Failed to receive messages: {e}")
                
        if args.reboot_router:
            logger.info("Rebooting router...")
            try:
                client.device.reboot()
                logger.info("Router reboot command sent successfully. The router will restart shortly.")
            except Exception as e:
                logger.error(f"Failed to reboot router: {e}")

        if args.network_stats:
            logger.info("Fetching network stats...")
            try:
                # Get signal and network info
                signal_info = client.device.signal()
                status_info = client.monitoring.status()
                network_type_raw = str(status_info.get("CurrentNetworkType", "0"))

                network_type_map = {
                    "0": "No Service", "1": "GSM", "2": "GPRS", "3": "EDGE", "4": "WCDMA",
                    "5": "HSDPA", "6": "HSUPA", "7": "HSPA", "8": "TDSCDMA", "9": "HSPA+",
                    "10": "EVDO Rev.0", "11": "EVDO Rev.A", "12": "EVDO Rev.B", "13": "1xRTT",
                    "14": "UMB", "15": "1xEVDV", "16": "3xRTT", "17": "HSPA+ 64QAM",
                    "18": "HSPA+ MIMO", "19": "LTE", "41": "LTE CA", "101": "NR5G NSA",
                    "102": "NR5G SA",
                }
                plmn_info = client.net.current_plmn()

                # Parse and determine values
                rsrp = parse_dbm(signal_info.get("rsrp"))
                rsrq = signal_info.get("rsrq")
                sinr = signal_info.get("sinr")

                level = get_signal_level(rsrp)
                bars = SIGNAL_LEVELS.get(level, SIGNAL_LEVELS[0])

                operator_name = plmn_info.get("FullName") or plmn_info.get("ShortName") or "Unknown"

                # Map internal mode codes (if any) to readable labels
                mode_map = {
                    "LTE": "4G", "WCDMA": "3G", "GSM": "2G", "NR5G": "5G", "NR": "5G",
                }
                readable_mode = network_type_map.get(network_type_raw, f"Unknown ({network_type_raw})")
                if readable_mode in mode_map:
                    readable_mode = mode_map[readable_mode]

                # Get IP address
                config = client.config_lan.config()
                modem_ip = "Unknown IP"
                try:
                    # Using get() cautiously to traverse structure smoothly
                    modem_ip = config.get("config", {}).get("dhcps", {}).get("ipaddress", "Unknown IP")
                except Exception:
                    pass

                # Display
                print(f"{operator_name} {readable_mode} {bars}")

                print(f"  RSRP: {signal_info.get('rsrp')}")
                if rsrq:
                    print(f"  RSRQ: {rsrq}")
                if sinr:
                    print(f"  SINR: {sinr}")
                print(f"  IP: {modem_ip}")

            except Exception as e:
                logger.error(f"Failed to get network stats: {e}")

    except Exception as e:
        logger.error(f"Connection or execution error: {e}")

if __name__ == "__main__":
    main()
