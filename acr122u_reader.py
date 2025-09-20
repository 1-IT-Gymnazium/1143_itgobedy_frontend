"""
ACR122U Card Reader Integration
This script reads NFC cards using the ACR122U reader and sends data to the Socket.IO server
"""

import time
import requests
import json
from smartcard.System import readers
from smartcard.util import toHexString
from smartcard.CardMonitoring import CardMonitor, CardObserver
from smartcard.Exceptions import NoCardException, CardConnectionException
import threading

class CardReaderObserver(CardObserver):
    """Observer for card insertion/removal events"""

    def __init__(self):
        self.socketio_url = "http://localhost:3001/api/card-scan"
        self.last_card_uid = None
        self.card_present = False

    def update(self, observable, actions):
        """Called when card events occur"""
        (addedcards, removedcards) = actions

        # Handle card insertion
        for card in addedcards:
            self.card_present = True
            print(f"🔍 Card inserted: {card}")
            self.handle_card_inserted(card)

        # Handle card removal
        for card in removedcards:
            self.card_present = False
            print(f"❌ Card removed: {card}")
            self.handle_card_removed(card)

    def handle_card_inserted(self, card):
        """Handle card insertion - read UID and send to server"""
        try:
            # Connect to the card
            connection = card.createConnection()
            connection.connect()

            # Get card UID using standard APDU command
            # Command: Get UID (APDU: FF CA 00 00 00)
            get_uid_command = [0xFF, 0xCA, 0x00, 0x00, 0x00]

            response, sw1, sw2 = connection.transmit(get_uid_command)

            if sw1 == 0x90 and sw2 == 0x00:  # Success
                # Convert response to hex string
                card_uid = toHexString(response).replace(' ', '').upper()
                print(f"✅ Card UID read: {card_uid}")

                # Only send if it's a different card
                if card_uid != self.last_card_uid:
                    self.last_card_uid = card_uid
                    self.send_card_data(card_uid)

            else:
                print(f"❌ Failed to read card UID: SW1={sw1:02X}, SW2={sw2:02X}")

            connection.disconnect()

        except (NoCardException, CardConnectionException) as e:
            print(f"❌ Card connection error: {e}")
        except Exception as e:
            print(f"❌ Unexpected error reading card: {e}")

    def handle_card_removed(self, card):
        """Handle card removal"""
        self.last_card_uid = None
        print("📤 Card removed from reader")

    def send_card_data(self, card_uid):
        """Send card UID to Socket.IO server"""
        try:
            payload = {"card_uid": card_uid}

            print(f"📡 Sending card data to server: {card_uid}")
            response = requests.post(
                self.socketio_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=5
            )

            if response.status_code == 200:
                result = response.json()
                print(f"✅ Server response: {result}")
            else:
                print(f"❌ Server error: {response.status_code} - {response.text}")

        except requests.RequestException as e:
            print(f"❌ Failed to send card data to server: {e}")
        except Exception as e:
            print(f"❌ Unexpected error sending data: {e}")

def main():
    """Main function to start card monitoring"""
    print("🚀 Starting ACR122U Card Reader Integration")
    print("=" * 50)

    # Check for available readers
    available_readers = readers()

    if not available_readers:
        print("❌ No card readers found!")
        print("   Please ensure your ACR122U reader is connected and drivers are installed.")
        return

    print(f"📱 Found {len(available_readers)} card reader(s):")
    for i, reader in enumerate(available_readers):
        print(f"   {i+1}. {reader}")

    # Find ACR122U reader
    acr122u_reader = None
    for reader in available_readers:
        if "ACR122" in str(reader).upper():
            acr122u_reader = reader
            break

    if not acr122u_reader:
        print("⚠️  ACR122U reader not found, using first available reader")
        acr122u_reader = available_readers[0]

    print(f"🔌 Using reader: {acr122u_reader}")
    print()

    # Test connection to Socket.IO server
    try:
        response = requests.get("http://localhost:3001/api/students", timeout=5)
        if response.status_code == 200:
            print("✅ Socket.IO server connection: OK")
        else:
            print("⚠️  Socket.IO server responded but with error")
    except requests.RequestException:
        print("❌ Cannot connect to Socket.IO server at http://localhost:3001")
        print("   Please ensure the card-reader-server.cjs is running")
        return

    print()
    print("👀 Monitoring for card events...")
    print("   Place a card on the reader to test")
    print("   Press Ctrl+C to stop")
    print()

    # Start card monitoring
    observer = CardReaderObserver()
    monitor = CardMonitor()
    monitor.addObserver(observer)

    try:
        # Keep the script running
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n🛑 Stopping card reader monitoring...")
        monitor.deleteObserver(observer)
        print("✅ Card reader stopped")

if __name__ == "__main__":
    main()
