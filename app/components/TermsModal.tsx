import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg'; // For close icon

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  // Placeholder Terms Text - Replace with your actual terms
  const termsContent = `
Last Updated: 18/04/2025

Welcome to HotelHero! These terms and conditions outline the rules and regulations for the use of HotelHero's Game, located at [Your App/Website].

By accessing this game we assume you accept these terms and conditions. Do not continue to use HotelHero if you do not agree to take all of the terms and conditions stated on this page.

**1. License**
Unless otherwise stated, HotelHero and/or its licensors own the intellectual property rights for all material on HotelHero. All intellectual property rights are reserved. You may access this from HotelHero for your own personal use subjected to restrictions set in these terms and conditions.

You must not:
- Republish material from HotelHero
- Sell, rent or sub-license material from HotelHero
- Reproduce, duplicate or copy material from HotelHero
- Redistribute content from HotelHero

**2. User Content**
Parts of this game may offer an opportunity for users to post and exchange opinions and information. HotelHero does not filter, edit, publish or review Comments prior to their presence on the game. Comments do not reflect the views and opinions of HotelHero, its agents and/or affiliates.

**3. Virtual Items**
The game may include virtual currency or items ("Virtual Items"). You agree that Virtual Items have no monetary value and do not constitute actual currency or property of any type. Virtual Items cannot be redeemed for cash or other items of monetary value.

**4. Termination**
We may terminate or suspend your access immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms and Conditions.

**5. Limitation of Liability**
In no event shall HotelHero, nor any of its officers, directors and employees, be held liable for anything arising out of or in any way connected with your use of this game whether such liability is under contract.

**6. Governing Law**
These Terms will be governed by and interpreted in accordance with the laws of the State/Country of [Your Jurisdiction], and you submit to the non-exclusive jurisdiction of the state and federal courts located in [Your Jurisdiction] for the resolution of any disputes.

... [Add more sections as needed] ...

By clicking "Agree" or continuing to use the game, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
  `;

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="fade" // Or "slide"
      onRequestClose={onClose} // Handle Android back button
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={styles.modalContainer}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Terms & Conditions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButtonIcon}>
              <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Basic Markdown-like rendering (split by newline, bold handling) */}
            {termsContent.split('\n').map((paragraph, index) => {
                if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                    return <Text key={index} style={[styles.termsText, styles.boldText]}>{paragraph.substring(2, paragraph.length - 2)}</Text>;
                }
                if (paragraph.startsWith('- ')) {
                    return <Text key={index} style={[styles.termsText, styles.listItem]}>{`\u2022 ${paragraph.substring(2)}`}</Text>;
                }
                return <Text key={index} style={styles.termsText}>{paragraph}</Text>;
            })}
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 40, // Ensure modal fits on screen vertically
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    paddingBottom: 15, // Reduce bottom padding as button has its own margin
    width: '100%',
    maxWidth: 500,
    maxHeight: screenHeight * 0.85, // Limit max height
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb', // slate-200
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937', // slate-800
    flex: 1, // Allow title to take space
    marginRight: 10, // Space before close icon
  },
  closeButtonIcon: {
    padding: 5, // Easier touch target
  },
  scrollView: {
    flex: 1, // Takes remaining space before the close button
    marginBottom: 15,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4b5563', // slate-600
    marginBottom: 12, // Space between paragraphs
  },
  boldText: {
    fontWeight: 'bold',
    color: '#374151', // slate-700
  },
  listItem: {
    marginLeft: 10, // Indent list items
  },
  closeButton: {
    backgroundColor: '#2563eb', // blue-600
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 'auto', // Push to bottom within the container flex layout
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TermsModal;