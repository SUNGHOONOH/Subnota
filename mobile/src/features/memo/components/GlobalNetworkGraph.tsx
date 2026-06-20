import React from 'react';

import GlobalNetworkGraphShared, {
  defaultGlobalNetworkGraphConfig,
  GlobalNetworkGraphProps,
} from './GlobalNetworkGraph.shared';

const GlobalNetworkGraph = (props: GlobalNetworkGraphProps) => {
  return (
    <GlobalNetworkGraphShared
      {...props}
      platformConfig={defaultGlobalNetworkGraphConfig}
    />
  );
};

export default GlobalNetworkGraph;
