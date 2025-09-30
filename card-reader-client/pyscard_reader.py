#!/usr/bin/env python3
"""
ACR122U Card Reader Integration using pyscard
This script reads NFC cards using any PC/SC compatible reader and sends data to the card reader server.
Works with ACR122U, ACR38U, Omnikey, and other PC/SC devices.
"""

import time
import requests
import json
import os
import threading
from typing import Optional
from colorama import init, Fore, Style

# pyscard imports
try:
    from smartcard.System import readers
    from smartcard.util import toHexString
    from smartcard.CardMonitoring import CardMonitor, CardObserver
    from smartcard.CardType import AnyCardType
    from smartcard.CardRequest import CardRequest
    from smartcard.Exceptions import NoCardException, CardConnectionException, CardRequestTimeoutException
    PYSCARD_AVAILABLE = True
except ImportError as e:
    print(f"Error: pyscard library not available: {e}")
    print("Install with: pip install pyscard")
    PYSCARD_AVAILABLE = False
    exit(1)

# Initialize colorama for colored output
init()

# Configuration
SERVER_URL = os.getenv('SERVER_URL', 'http://localhost:3001')
CARD_SCAN_ENDPOINT = '/api/card-scan'
HEALTH_ENDPOINT = '/api/health'
READER_NAME = os.getenv('READER_NAME', None)  # Specific reader name or None for auto-detect

class CardReaderObserver(CardObserver):
    """Observer for card insertion/removal events"""

    def __init__(self):
        self.server_url = f"{SERVER_URL}{CARD_SCAN_ENDPOINT}"
        self.health_url = f"{SERVER_URL}{HEALTH_ENDPOINT}"
        self.last_card_uid = None
        self.card_present = False
        self.processing = False

    def print_status(self, message: str, status_type: str = "info"):
        """Print colored status messages."""
        colors = {
            "info": Fore.CYAN,
            "success": Fore.GREEN,
            "warning": Fore.YELLOW,
            "error": Fore.RED,
            "card": Fore.MAGENTA
        }
        color = colors.get(status_type, Fore.WHITE)
        timestamp = time.strftime("%H:%M:%S")
        print(f"{color}[{timestamp}] {message}{Style.RESET_ALL}")

    def update(self, observable, actions):
        """Called when card events occur"""
        (addedcards, removedcards) = actions

        # Handle card insertion
        for card in addedcards:
            if not self.processing:
                self.card_present = True
                self.print_status(f"Card inserted: {card}", "info")
                threading.Thread(target=self.handle_card_inserted, args=(card,), daemon=True).start()

        # Handle card removal
        for card in removedcards:
            self.card_present = False
            self.print_status("Card removed", "info")
            self.handle_card_removed(card)

    def handle_card_inserted(self, card):
        """Handle card insertion - read UID and send to server"""
        if self.processing:
            return

        self.processing = True

        try:
            # Connect to the card
            connection = card.createConnection()
            connection.connect()

            self.print_status("Connected to card, reading UID...", "info")

            # Try multiple methods to get card UID
            card_uid = self.get_card_uid(connection)

            if card_uid:
                self.print_status(f"Card UID read: {card_uid}", "card")

                # Only send if it's a different card
                if card_uid != self.last_card_uid:
                    self.last_card_uid = card_uid
                    self.send_card_data(card_uid)
                else:
                    self.print_status("Same card detected - ignoring duplicate", "warning")
            else:
                self.print_status("Failed to read card UID", "error")

            connection.disconnect()

        except (NoCardException, CardConnectionException) as e:
            self.print_status(f"Card connection error: {e}", "error")
        except Exception as e:
            self.print_status(f"Unexpected error reading card: {e}", "error")
        finally:
            self.processing = False

    def get_card_uid(self, connection) -> Optional[str]:
        """Extract UID from card using various methods"""
        try:
            # Method 1: Try standard GET_UID commands for ISO14443 cards
            get_uid_commands = [
                # Standard GET_UID for ISO14443A/B cards
                [0xFF, 0xCA, 0x00, 0x00, 0x00],
                # Alternative GET_DATA command
                [0x00, 0xCA, 0x01, 0x00, 0x00],
                # 4-byte UID request
                [0xFF, 0xCA, 0x00, 0x00, 0x04],
                # 7-byte UID request
                [0xFF, 0xCA, 0x00, 0x00, 0x07],
                # 10-byte UID request (for some special cards)
                [0xFF, 0xCA, 0x00, 0x00, 0x0A],
            ]

            for i, cmd in enumerate(get_uid_commands):
                try:
                    response, sw1, sw2 = connection.transmit(cmd)

                    # Check if command was successful
                    if sw1 == 0x90 and sw2 == 0x00 and response:
                        uid = toHexString(response).replace(' ', '').upper()
                        self.print_status(f"UID extracted using method {i+1}: {uid}", "success")
                        return uid

                except Exception as e:
                    self.print_status(f"Method {i+1} failed: {e}", "warning")
                    continue

            # Method 2: Try to read first block (for MIFARE Classic cards)
            try:
                self.print_status("Trying MIFARE block read method...", "info")
                # MIFARE Classic read block 0 command
                read_cmd = [0xFF, 0xB0, 0x00, 0x00, 0x10]
                response, sw1, sw2 = connection.transmit(read_cmd)

                if sw1 == 0x90 and sw2 == 0x00 and len(response) >= 4:
                    # First 4 bytes are usually the UID for MIFARE
                    uid = toHexString(response[:4]).replace(' ', '').upper()
                    self.print_status(f"UID extracted from MIFARE block: {uid}", "success")
                    return uid

            except Exception as e:
                self.print_status(f"MIFARE block read failed: {e}", "warning")

            # Method 3: Try ATR (Answer To Reset) analysis
            try:
                self.print_status("Analyzing ATR for UID...", "info")
                atr = connection.getATR()
                if atr and len(atr) > 4:
                    atr_hex = toHexString(atr).replace(' ', '').upper()
                    self.print_status(f"ATR: {atr_hex}", "info")

                    # Some cards include UID in the ATR historical bytes
                    # This is a simplified approach - different card types have different formats
                    if len(atr) >= 8:
                        # Try last 4 bytes as potential UID
                        possible_uid = toHexString(atr[-4:]).replace(' ', '').upper()
                        self.print_status(f"Possible UID from ATR: {possible_uid}", "warning")
                        return possible_uid

            except Exception as e:
                self.print_status(f"ATR analysis failed: {e}", "warning")

            self.print_status("Could not extract UID using any method", "error")
            return None

        except Exception as e:
            self.print_status(f"Error in UID extraction: {e}", "error")
            return None

    def handle_card_removed(self, card):
        """Handle card removal"""
        self.last_card_uid = None
        self.processing = False

    def send_card_data(self, card_uid):
        """Send card UID to the server"""
        try:
            payload = {"card_uid": card_uid}

            self.print_status(f"Sending card data to server: {card_uid}", "info")
            response = requests.post(
                self.server_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )

            if response.status_code == 200:
                result = response.json()

                # Handle different response types
                if result.get('success'):
                    if 'student' in result:
                        student = result['student']
                        self.print_status(
                            f"✅ Student found: {student['student_name']} (ID: {student.get('student_id', 'N/A')})",
                            "success"
                        )
                        if student.get('lunch_number'):
                            self.print_status(f"🍽️ Lunch number: {student['lunch_number']}", "success")
                    elif result.get('unassigned'):
                        self.print_status(f"❓ Unassigned card: {card_uid}", "warning")
                    else:
                        self.print_status("✅ Card processed successfully", "success")

                    # Log the full response for debugging
                    self.print_status(f"Server response: {result}", "info")
                else:
                    self.print_status(f"❌ Server rejected card: {result.get('error', 'Unknown error')}", "error")
            else:
                self.print_status(f"❌ Server error: {response.status_code} - {response.text}", "error")

        except requests.exceptions.ConnectionError:
            self.print_status("❌ Connection error - is the card reader server running?", "error")
            self.print_status("Start server with: npm run dev", "info")
        except requests.exceptions.Timeout:
            self.print_status("❌ Request timeout - server may be overloaded", "error")
        except Exception as e:
            self.print_status(f"❌ Failed to send card data: {e}", "error")

    def check_server_health(self):
        """Check if the card reader server is available"""
        try:
            response = requests.get(self.health_url, timeout=5)
            if response.status_code == 200:
                health_data = response.json()
                self.print_status(
                    f"Server healthy - {health_data.get('clients', 0)} clients connected",
                    "success"
                )
                return True
            else:
                self.print_status(f"Server health check failed: {response.status_code}", "warning")
                return False
        except Exception as e:
            self.print_status(f"Cannot reach server: {e}", "error")
            return False

def discover_readers():
    """Discover available PC/SC card readers"""
    try:
        available_readers = readers()
        return available_readers
    except Exception as e:
        print(f"{Fore.RED}Error discovering readers: {e}{Style.RESET_ALL}")
        return []

def select_reader(available_readers, preferred_name=None):
    """Select a card reader from available readers"""
    if not available_readers:
        return None

    # If a specific reader name is preferred, try to find it
    if preferred_name:
        for reader in available_readers:
            if preferred_name.lower() in str(reader).lower():
                print(f"{Fore.GREEN}Selected preferred reader: {reader}{Style.RESET_ALL}")
                return reader
        print(f"{Fore.YELLOW}Preferred reader '{preferred_name}' not found{Style.RESET_ALL}")

    # Otherwise, use the first available reader
    selected = available_readers[0]
    print(f"{Fore.GREEN}Selected reader: {selected}{Style.RESET_ALL}")
    return selected

def test_reader_connection(reader):
    """Test if we can connect to the selected reader"""
    try:
        print(f"{Fore.CYAN}Testing connection to reader...{Style.RESET_ALL}")

        # Try to connect to any card present
        cardtype = AnyCardType()
        cardrequest = CardRequest(timeout=1, cardType=cardtype, readers=[reader])

        try:
            cardservice = cardrequest.waitforcard()
            print(f"{Fore.GREEN}✅ Reader is working (card detected){Style.RESET_ALL}")
            return True
        except CardRequestTimeoutException:
            print(f"{Fore.GREEN}✅ Reader is working (no card present){Style.RESET_ALL}")
            return True

    except Exception as e:
        print(f"{Fore.RED}❌ Reader test failed: {e}{Style.RESET_ALL}")
        return False

def main():
    """Main function to run the card reader"""
    print(f"{Fore.MAGENTA}ACR122U Card Reader using pyscard{Style.RESET_ALL}")
    print(f"{Fore.MAGENTA}=" * 50 + Style.RESET_ALL)
    print(f"{Fore.CYAN}Server URL: {SERVER_URL}{Style.RESET_ALL}")

    if not PYSCARD_AVAILABLE:
        print(f"{Fore.RED}❌ pyscard library not available{Style.RESET_ALL}")
        return 1

    # Create observer instance
    observer = CardReaderObserver()

    # Check server health
    print(f"\n{Fore.CYAN}Checking server connection...{Style.RESET_ALL}")
    if not observer.check_server_health():
        print(f"{Fore.YELLOW}⚠️ Server not available - continuing anyway{Style.RESET_ALL}")
        print(f"{Fore.YELLOW}Make sure to run 'npm run dev' to start the server{Style.RESET_ALL}")

    # Discover card readers
    print(f"\n{Fore.CYAN}Discovering card readers...{Style.RESET_ALL}")
    available_readers = discover_readers()

    if not available_readers:
        print(f"{Fore.RED}❌ No card readers found!{Style.RESET_ALL}")
        print(f"{Fore.YELLOW}Please check:{Style.RESET_ALL}")
        print("  - Card reader is connected to USB")
        print("  - Drivers are installed")
        print("  - PC/SC service is running")
        return 1

    print(f"{Fore.GREEN}Found {len(available_readers)} reader(s):{Style.RESET_ALL}")
    for i, reader in enumerate(available_readers):
        print(f"  {i+1}: {reader}")

    # Select reader
    selected_reader = select_reader(available_readers, READER_NAME)
    if not selected_reader:
        print(f"{Fore.RED}❌ No suitable reader found{Style.RESET_ALL}")
        return 1

    # Test reader connection
    if not test_reader_connection(selected_reader):
        print(f"{Fore.RED}❌ Reader connection test failed{Style.RESET_ALL}")
        return 1

    # Start card monitoring
    print(f"\n{Fore.GREEN}Starting card monitoring...{Style.RESET_ALL}")
    print(f"{Fore.CYAN}Present cards to the reader. Press Ctrl+C to stop.{Style.RESET_ALL}")

    try:
        monitor = CardMonitor()
        monitor.addObserver(observer)

        # Keep the program running
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}Stopping card reader...{Style.RESET_ALL}")
    except Exception as e:
        print(f"\n{Fore.RED}❌ Error: {e}{Style.RESET_ALL}")
        return 1
    finally:
        try:
            monitor.deleteObserver(observer)
        except:
            pass
        print(f"{Fore.GREEN}✅ Card reader stopped successfully{Style.RESET_ALL}")

    return 0

if __name__ == "__main__":
    exit(main())
