import { createTheme, type MantineColorsTuple } from '@mantine/core';

// $base-color of the former Ext theme: #116EB5
const brand: MantineColorsTuple = ['#e7f3fc', '#cfe3f5', '#9fc5ea', '#6ca5df', '#438ad6', '#2a79d1', '#116eb5', '#0a5fa0', '#00548f', '#00487f'];

export const theme = createTheme({
	primaryColor: 'brand',
	primaryShade: 6,
	colors: { brand },
	fontFamily: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
	defaultRadius: 'sm',
});
