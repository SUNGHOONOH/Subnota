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
          placeholderTextColor="#B5A898"
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
    backgroundColor: '#F5EFE5',
    borderColor: '#E5DDD0',
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    maxWidth: '86%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#5C4D3C',
    borderColor: '#5C4D3C',
  },
  messageText: {
    color: '#2C2520',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FAF6F0',
  },
  composer: {
    alignItems: 'center',
    borderTopColor: '#E5DDD0',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    backgroundColor: '#F5EFE5',
    borderColor: '#E5DDD0',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#2C2520',
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#5C4D3C',
    borderRadius: 6,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
});

export default BriefingChat;
