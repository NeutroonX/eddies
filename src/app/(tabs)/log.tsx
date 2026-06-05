import { Redirect } from 'expo-router';

// This screen is never reached — the LOG tab button opens the entry modal directly.
export default function LogTabPlaceholder() {
  return <Redirect href="/(modals)/entry" />;
}
