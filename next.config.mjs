/** @type {import('next').NextConfig} */
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = {
  // Lint and type errors MUST be caught by CI

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },
};

export default withSentryConfig(
  nextConfig,
  {
    org: "edusync-saas",
    project: "edusync-web",
    silent: true, // Suppresses all logs
    widenClientFileUpload: true,
    transpileClientSDK: true,
    hideSourceMaps: true,
    // Fix deprecation warnings
    webpack: (config, options) => {
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
      };
      // Replace deprecated disableLogger with treeshake option
      if (config.optimization && config.optimization.minimizer) {
        config.optimization.minimizer.forEach((minimizer) => {
          if (minimizer.constructor.name === 'TerserPlugin') {
            minimizer.options.terserOptions = {
              ...minimizer.options.terserOptions,
              compress: {
                ...minimizer.options.terserOptions.compress,
                drop_console: true,
                drop_debugger: true,
              },
            };
          }
        });
      }
      config.automaticVercelMonitors = true;
      return config;
    },
  }
);
