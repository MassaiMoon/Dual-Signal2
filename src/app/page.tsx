import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { EntryForm } from './_entry-form';

export default async function Home() {
  const jar = await cookies();
  if (jar.has('ds_session')) redirect('/me');
  return (
    <Suspense>
      <EntryForm />
    </Suspense>
  );
}
