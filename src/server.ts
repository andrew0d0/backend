import app from './app';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Ad Link Bypass Backend listening on port ${PORT}`);
});
