import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Send } from 'lucide-react-native';

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
}

interface BriefingChatProps {
  draft: string;
  messages: ChatMessage[];
  onChangeDraft: (text: string) => void;
  onSend: () => void;
}

const BriefingChat = ({
  draft,
  messages,
  onChangeDraft,
  onSend,
}: BriefingChatProps) => {
  return (
    <>
      <View style={styles.chatLog}>
        {messages.map(message => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.role === 'user' && styles.userBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.role === 'user' && styles.userMessageText,
              ]}
            >
              {message.text}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.composer}>
        <TextInput
          onChangeText={onChangeDraft}
          onSubmitEditing={onSend}
          placeholder="지금 뭐부터 하지?"
          placeholderTextColor="#9A9AA0"
          returnKeyType="send"
          style={styles.input}
          value={draft}
        />
        <Pressable
          accessibilityLabel="브리핑 질문 보내기"
          onPress={onSend}
          style={styles.sendButton}
        >
          <Send size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  chatLog: {
    paddingTop: 18,
  },
  messageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E0D6',
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    maxWidth: '86%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1D1D1F',
    borderColor: '#1D1D1F',
  },
  messageText: {
    color: '#1D1D1F',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  composer: {
    alignItems: 'center',
    borderTopColor: '#E5E0D6',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E0D6',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#1D1D1F',
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#1D1D1F',
    borderRadius: 6,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
});

export default BriefingChat;
