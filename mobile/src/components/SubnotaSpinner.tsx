import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const PETAL_PATH =
  'M0,-4 C-10,-11 -15,-30 -11,-41 C-8,-48 8,-48 11,-41 C15,-30 10,-11 0,-4';
const PETAL_PLACEMENTS = [
  [49.7, 47, -6, 1.04],
  [52.8, 48.9, 68, 0.97],
  [51.7, 52.5, 145, 1.06],
  [48.5, 52.6, 210, 0.98],
  [47.2, 48.9, 292, 1.02],
] as const;

const SubnotaSpinner = ({
  color = '#CC785C',
  size = 24,
}: {
  color?: string;
  size?: number;
}) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        duration: 1100,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [rotation]);

  return (
    <Animated.View
      accessibilityLabel="처리 중"
      style={[
        styles.root,
        {
          height: size,
          transform: [
            {
              rotate: rotation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
          width: size,
        },
      ]}
    >
      <Svg height={size} viewBox="0 0 100 100" width={size}>
        {PETAL_PLACEMENTS.map(([x, y, rotate, scale], index) => (
          <Path
            d={PETAL_PATH}
            fill={color}
            key={index}
            transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}
          />
        ))}
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SubnotaSpinner;
