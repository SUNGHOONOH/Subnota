import { StyleProp, ViewStyle } from 'react-native';

export interface PlatformModalProps {
  animationType?: 'none' | 'slide' | 'fade';
  children: React.ReactNode;
  onRequestClose?: () => void;
  style?: StyleProp<ViewStyle>;
  transparent?: boolean;
  visible: boolean;
}
