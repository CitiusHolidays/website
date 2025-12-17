import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { updateUserProfile } from '@/lib/db/queries';

const phoneRegex = /^(\+\d{1,3}[\s.-]?)?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})$/;

export async function PUT(request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'You must be signed in to update your profile.' },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    const { name, phoneNumber } = body || {};
    const trimmedName = (name || '').toString().trim();
    const trimmedPhone = (phoneNumber || '').toString().trim();

    if (!trimmedName || trimmedName.length < 2) {
      return NextResponse.json(
        { error: 'Please provide your full name (at least 2 characters).' },
        { status: 400 }
      );
    }

    if (trimmedName.length > 80) {
      return NextResponse.json(
        { error: 'Name is too long. Please keep it under 80 characters.' },
        { status: 400 }
      );
    }

    if (trimmedPhone && !phoneRegex.test(trimmedPhone)) {
      return NextResponse.json(
        { error: 'Please provide a valid phone number (e.g., +1 555-123-4567).' },
        { status: 400 }
      );
    }

    const updated = await updateUserProfile(session.user.id, {
      name: trimmedName,
      phoneNumber: trimmedPhone || null,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 }
      );
    }

    const responseUser = {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      phoneNumber: updated.phoneNumber || '',
      image: updated.image,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      passportDetailsEncrypted: updated.passportDetailsEncrypted,
    };

    return NextResponse.json({ user: responseUser });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Unable to update profile. Please try again.' },
      { status: 500 }
    );
  }
}




