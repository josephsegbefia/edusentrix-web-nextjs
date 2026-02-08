# Mobile UI Components & Patterns Guide

## Overview

This document provides comprehensive React Native component templates, form patterns, toast/notification systems, and essential UI elements for the EduSentrix mobile app. All components follow the web app's premium design system: glassmorphism effects, dark theme, gradient accents, and smooth animations.

## Design System Constants

```typescript
// colors.ts
export const colors = {
  // Backgrounds
  background: '#0b1220',
  card: 'rgba(255, 255, 255, 0.05)',
  cardBorder: 'rgba(255, 255, 255, 0.1)',

  // Accent Colors
  primary: '#3b82f6',      // Blue
  secondary: '#8b5cf6',     // Purple
  success: '#10b981',       // Emerald
  warning: '#f59e0b',       // Amber
  danger: '#ef4444',        // Red

  // Text
  textPrimary: 'rgba(255, 255, 255, 0.9)',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.5)',

  // Inputs
  input: 'rgba(255, 255, 255, 0.05)',
  inputBorder: 'rgba(255, 255, 255, 0.1)',
  inputFocus: '#3b82f6',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const gradients = {
  blue: ['rgba(59, 130, 246, 0.25)', 'rgba(59, 130, 246, 0.10)', 'transparent'],
  purple: ['rgba(139, 92, 246, 0.25)', 'rgba(139, 92, 246, 0.10)', 'transparent'],
  emerald: ['rgba(16, 185, 129, 0.25)', 'rgba(16, 185, 129, 0.10)', 'transparent'],
  amber: ['rgba(245, 158, 11, 0.25)', 'rgba(245, 158, 11, 0.10)', 'transparent'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  h4: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  label: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
};
```

---

## 1. Form Components

### 1.1 Text Input

```typescript
// components/forms/TextInput.tsx
import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { colors, spacing, typography } from '@/constants/design';

interface TextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  style,
  ...props
}) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[
        styles.inputContainer,
        error && styles.inputContainerError,
        props.editable === false && styles.inputContainerDisabled,
      ]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
          ]}
          placeholderTextColor={colors.textMuted}
          {...props}
        />

        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>

      {(error || helperText) && (
        <Text style={[styles.helperText, error && styles.errorText]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    minHeight: 44, // Touch target minimum
  },
  inputContainerError: {
    borderColor: colors.danger,
  },
  inputContainerDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputWithLeftIcon: {
    paddingLeft: spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: spacing.xs,
  },
  leftIcon: {
    paddingLeft: spacing.md,
  },
  rightIcon: {
    paddingRight: spacing.md,
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.danger,
  },
});
```

### 1.2 Select/Dropdown

```typescript
// components/forms/Select.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/design';
import { ChevronDown } from 'lucide-react-native';

interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  value?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  placeholder = 'Select an option',
  value,
  options,
  onChange,
  error,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={[
          styles.selectContainer,
          error && styles.selectContainerError,
          disabled && styles.selectContainerDisabled,
        ]}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
      >
        <Text style={[
          styles.selectText,
          !selectedOption && styles.selectPlaceholder,
        ]}>
          {selectedOption?.label || placeholder}
        </Text>
        <ChevronDown size={20} color={colors.textMuted} />
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || 'Select'}</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
              keyExtractor={item => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === value && styles.optionSelected,
                    item.disabled && styles.optionDisabled,
                  ]}
                  onPress={() => {
                    if (!item.disabled) {
                      onChange(item.value);
                      setIsOpen(false);
                    }
                  }}
                  disabled={item.disabled}
                >
                  <Text style={[
                    styles.optionText,
                    item.value === value && styles.optionTextSelected,
                    item.disabled && styles.optionTextDisabled,
                  ]}>
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  selectContainerError: {
    borderColor: colors.danger,
  },
  selectContainerDisabled: {
    opacity: 0.5,
  },
  selectText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  selectPlaceholder: {
    color: colors.textMuted,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  modalTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  modalClose: {
    ...typography.body,
    color: colors.primary,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  optionSelected: {
    backgroundColor: colors.input,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  optionTextDisabled: {
    color: colors.textMuted,
  },
  checkmark: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});
```

### 1.3 Date Picker

```typescript
// components/forms/DatePicker.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, typography } from '@/constants/design';
import { Calendar } from 'lucide-react-native';
import { format } from 'date-fns';

interface DatePickerProps {
  label?: string;
  value?: Date;
  onChange: (date: Date) => void;
  error?: string;
  disabled?: boolean;
  mode?: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  error,
  disabled,
  mode = 'date',
  minimumDate,
  maximumDate,
}) => {
  const [show, setShow] = useState(false);
  const [internalDate, setInternalDate] = useState(value || new Date());

  const handleChange = (event: any, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios');
    if (selectedDate) {
      setInternalDate(selectedDate);
      onChange(selectedDate);
    }
  };

  const formatDate = (date: Date) => {
    if (mode === 'date') return format(date, 'MMM dd, yyyy');
    if (mode === 'time') return format(date, 'hh:mm a');
    return format(date, 'MMM dd, yyyy hh:mm a');
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={[
          styles.pickerContainer,
          error && styles.pickerContainerError,
          disabled && styles.pickerContainerDisabled,
        ]}
        onPress={() => !disabled && setShow(true)}
        disabled={disabled}
      >
        <Calendar size={20} color={colors.textMuted} />
        <Text style={styles.pickerText}>
          {value ? formatDate(value) : 'Select date'}
        </Text>
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {show && (
        <DateTimePicker
          value={internalDate}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  pickerContainerError: {
    borderColor: colors.danger,
  },
  pickerContainerDisabled: {
    opacity: 0.5,
  },
  pickerText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
```

### 1.4 Form Validation Hook

```typescript
// hooks/useForm.ts
import { useState, useCallback } from 'react';
import { z } from 'zod';

type FormErrors<T> = Partial<Record<keyof T, string>>;

export function useForm<T extends Record<string, any>>(
  initialValues: T,
  schema?: z.ZodSchema<T>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const setValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [errors]);

  const setFieldTouched = useCallback((field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const validate = useCallback(() => {
    if (!schema) return true;

    try {
      schema.parse(values);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formErrors: FormErrors<T> = {};
        error.errors.forEach(err => {
          const path = err.path[0] as keyof T;
          if (path) {
            formErrors[path] = err.message;
          }
        });
        setErrors(formErrors);
      }
      return false;
    }
  }, [values, schema]);

  const handleSubmit = useCallback((onSubmit: (values: T) => void | Promise<void>) => {
    return async () => {
      if (validate()) {
        await onSubmit(values);
      }
    };
  }, [values, validate]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    setValue,
    setFieldTouched,
    validate,
    handleSubmit,
    reset,
  };
}
```

### 1.5 Complete Form Example

```typescript
// examples/PaymentForm.tsx
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { TextInput } from '@/components/forms/TextInput';
import { Select } from '@/components/forms/Select';
import { DatePicker } from '@/components/forms/DatePicker';
import { Button } from '@/components/ui/Button';
import { useForm } from '@/hooks/useForm';
import { z } from 'zod';
import { useToast } from '@/hooks/useToast';

const paymentSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  paymentDate: z.date(),
  receiptNumber: z.string().optional(),
  reference: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

export const PaymentForm: React.FC = () => {
  const toast = useToast();
  const form = useForm<PaymentFormData>(
    {
      amount: '',
      paymentMethod: '',
      paymentDate: new Date(),
      receiptNumber: '',
      reference: '',
    },
    paymentSchema
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      // API call here
      toast.success('Payment recorded successfully');
      form.reset();
    } catch (error) {
      toast.error('Failed to record payment');
    }
  });

  return (
    <ScrollView style={styles.container}>
      <TextInput
        label="Amount"
        placeholder="Enter amount"
        value={form.values.amount}
        onChangeText={(text) => form.setValue('amount', text)}
        onBlur={() => form.setFieldTouched('amount')}
        error={form.touched.amount ? form.errors.amount : undefined}
        keyboardType="numeric"
      />

      <Select
        label="Payment Method"
        placeholder="Select payment method"
        value={form.values.paymentMethod}
        options={[
          { label: 'Cash', value: 'cash' },
          { label: 'Bank Transfer', value: 'bank_transfer' },
          { label: 'Mobile Money', value: 'mobile_money' },
        ]}
        onChange={(value) => form.setValue('paymentMethod', value)}
        error={form.touched.paymentMethod ? form.errors.paymentMethod : undefined}
      />

      <DatePicker
        label="Payment Date"
        value={form.values.paymentDate}
        onChange={(date) => form.setValue('paymentDate', date)}
        error={form.touched.paymentDate ? form.errors.paymentDate : undefined}
      />

      <TextInput
        label="Receipt Number (Optional)"
        placeholder="Enter receipt number"
        value={form.values.receiptNumber}
        onChangeText={(text) => form.setValue('receiptNumber', text)}
      />

      <Button
        title="Record Payment"
        onPress={handleSubmit}
        style={styles.submitButton}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  submitButton: {
    marginTop: spacing.lg,
  },
});
```

---

## 2. Toast/Notification System

### 2.1 Toast Hook

```typescript
// hooks/useToast.ts
import { useCallback } from 'react';
import Toast from 'react-native-toast-message';

type ToastOptions = {
  description?: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
};

export function useToast() {
  const toast = useCallback((title: string, opts?: ToastOptions) => {
    Toast.show({
      type: 'info',
      text1: title,
      text2: opts?.description,
      visibilityTime: opts?.duration || 3500,
      props: {
        actionLabel: opts?.actionLabel,
        onAction: opts?.onAction,
      },
    });
  }, []);

  const success = useCallback((title: string, opts?: ToastOptions) => {
    Toast.show({
      type: 'success',
      text1: title,
      text2: opts?.description,
      visibilityTime: opts?.duration || 3000,
      props: {
        actionLabel: opts?.actionLabel,
        onAction: opts?.onAction,
      },
    });
  }, []);

  const error = useCallback((title: string, opts?: ToastOptions) => {
    Toast.show({
      type: 'error',
      text1: title,
      text2: opts?.description,
      visibilityTime: opts?.duration || 5000,
      props: {
        actionLabel: opts?.actionLabel,
        onAction: opts?.onAction,
      },
    });
  }, []);

  const warning = useCallback((title: string, opts?: ToastOptions) => {
    Toast.show({
      type: 'warning',
      text1: title,
      text2: opts?.description,
      visibilityTime: opts?.duration || 5000,
      props: {
        actionLabel: opts?.actionLabel,
        onAction: opts?.onAction,
      },
    });
  }, []);

  const promise = useCallback(<T,>(
    promise: Promise<T>,
    labels: { loading: string; success: string; error: string }
  ) => {
    Toast.show({
      type: 'info',
      text1: labels.loading,
      autoHide: false,
    });

    promise
      .then(() => {
        Toast.show({
          type: 'success',
          text1: labels.success,
        });
      })
      .catch(() => {
        Toast.show({
          type: 'error',
          text1: labels.error,
        });
      });
  }, []);

  return { toast, success, error, warning, promise };
}
```

### 2.2 Custom Toast Component

```typescript
// components/ui/Toast.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '@/constants/design';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';

const toastConfig = {
  success: ({ text1, text2, props }: any) => (
    <View style={styles.toastContainer}>
      <LinearGradient
        colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)']}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <CheckCircle size={20} color={colors.success} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{text1}</Text>
          {text2 && <Text style={styles.description}>{text2}</Text>}
        </View>
        {props?.actionLabel && (
          <TouchableOpacity onPress={props.onAction} style={styles.actionButton}>
            <Text style={styles.actionText}>{props.actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  ),

  error: ({ text1, text2, props }: any) => (
    <View style={styles.toastContainer}>
      <LinearGradient
        colors={['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.1)']}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <AlertCircle size={20} color={colors.danger} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{text1}</Text>
          {text2 && <Text style={styles.description}>{text2}</Text>}
        </View>
        {props?.actionLabel && (
          <TouchableOpacity onPress={props.onAction} style={styles.actionButton}>
            <Text style={styles.actionText}>{props.actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  ),

  warning: ({ text1, text2, props }: any) => (
    <View style={styles.toastContainer}>
      <LinearGradient
        colors={['rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.1)']}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <AlertTriangle size={20} color={colors.warning} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{text1}</Text>
          {text2 && <Text style={styles.description}>{text2}</Text>}
        </View>
        {props?.actionLabel && (
          <TouchableOpacity onPress={props.onAction} style={styles.actionButton}>
            <Text style={styles.actionText}>{props.actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  ),

  info: ({ text1, text2, props }: any) => (
    <View style={styles.toastContainer}>
      <LinearGradient
        colors={['rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.1)']}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <Info size={20} color={colors.primary} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{text1}</Text>
          {text2 && <Text style={styles.description}>{text2}</Text>}
        </View>
        {props?.actionLabel && (
          <TouchableOpacity onPress={props.onAction} style={styles.actionButton}>
            <Text style={styles.actionText}>{props.actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  toastContainer: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    minHeight: 60,
    overflow: 'hidden',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 1,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});

// Usage in App.tsx
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/components/ui/Toast';

export default function App() {
  return (
    <>
      {/* Your app components */}
      <Toast config={toastConfig} />
    </>
  );
}
```

---

## 3. Loading States

### 3.1 Skeleton Loader

```typescript
// components/ui/Skeleton.tsx
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/constants/design';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={[styles.container, { width, height, borderRadius }, style]}>
      <Animated.View
        style={[
          styles.shimmer,
          { opacity, borderRadius },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.input,
    overflow: 'hidden',
  },
  shimmer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
```

### 3.2 Card Skeleton

```typescript
// components/ui/CardSkeleton.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';
import { spacing } from '@/constants/design';

export const CardSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <Skeleton width="60%" height={16} />
      <Skeleton width="40%" height={12} style={styles.marginTop} />
      <Skeleton width="100%" height={12} style={styles.marginTop} />
      <Skeleton width="80%" height={32} style={styles.marginTop} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  marginTop: {
    marginTop: spacing.sm,
  },
});
```

### 3.3 Loading Spinner

```typescript
// components/ui/Spinner.tsx
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors } from '@/constants/design';

interface SpinnerProps {
  size?: number;
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 24,
  color = colors.primary,
}) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderColor: color,
          borderTopColor: 'transparent',
          transform: [{ rotate: spin }],
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: 12,
  },
});
```

---

## 4. Empty States

```typescript
// components/ui/EmptyState.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/design';
import { Inbox } from 'lucide-react-native';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <View style={styles.container}>
      {icon || <Inbox size={48} color={colors.textMuted} />}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.lg,
  },
});
```

---

## 5. Error States

```typescript
// components/ui/ErrorState.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/design';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'Please try again later',
  onRetry,
  retryLabel = 'Retry',
}) => {
  return (
    <View style={styles.container}>
      <AlertCircle size={48} color={colors.danger} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button
          title={retryLabel}
          onPress={onRetry}
          variant="outline"
          leftIcon={<RefreshCw size={16} color={colors.primary} />}
          style={styles.retryButton}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
  },
});
```

---

## 6. Modal/Dialog

```typescript
// components/ui/Modal.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography } from '@/constants/design';
import { X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  footer,
  showCloseButton = true,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.content}>
            {(title || showCloseButton) && (
              <View style={styles.header}>
                {title && <Text style={styles.title}>{title}</Text>}
                {showCloseButton && (
                  <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView style={styles.body}>
              {children}
            </ScrollView>

            {footer && <View style={styles.footer}>{footer}</View>}
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay,
  },
  container: {
    width: '90%',
    maxHeight: '80%',
  },
  content: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  closeButton: {
    padding: spacing.xs,
  },
  body: {
    padding: spacing.md,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
});
```

---

## 7. Bottom Sheet

```typescript
// components/ui/BottomSheet.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, StyleSheet, PanResponder } from 'react-native';
import { colors, spacing, typography } from '@/constants/design';
import { BlurView } from 'expo-blur';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: number;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  height = 400,
}) => {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          onClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(height);
    }
  }, [visible, height, slideAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.container,
            {
              height,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handle} />
          {title && <Text style={styles.title}>{title}</Text>}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.textMuted,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});
```

---

## 8. Search Bar

```typescript
// components/ui/SearchBar.tsx
import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/design';
import { Search } from 'lucide-react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  onFocus,
  onBlur,
}) => {
  return (
    <View style={styles.container}>
      <Search size={20} color={colors.textMuted} style={styles.icon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
});
```

---

## 9. Badge/Tag

```typescript
// components/ui/Badge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/design';

interface BadgeProps {
  text: string;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

export const Badge: React.FC<BadgeProps> = ({
  text,
  variant = 'default',
  size = 'md',
}) => {
  const variantColors = {
    default: { bg: colors.input, text: colors.textPrimary },
    success: { bg: colors.success + '20', text: colors.success },
    danger: { bg: colors.danger + '20', text: colors.danger },
    warning: { bg: colors.warning + '20', text: colors.warning },
    info: { bg: colors.primary + '20', text: colors.primary },
  };

  const sizeStyles = {
    sm: { paddingHorizontal: spacing.xs, paddingVertical: 2, fontSize: 10 },
    md: { paddingHorizontal: spacing.sm, paddingVertical: 4, fontSize: 12 },
    lg: { paddingHorizontal: spacing.md, paddingVertical: 6, fontSize: 14 },
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: variantColors[variant].bg,
          ...sizeStyles[size],
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: variantColors[variant].text,
            fontSize: sizeStyles[size].fontSize,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
});
```

---

## 10. Pull to Refresh

```typescript
// Usage with FlatList
import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';

export const WardsList: React.FC = () => {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['wards'],
    queryFn: fetchWards,
  });

  return (
    <FlatList
      data={data}
      renderItem={({ item }) => <WardCard {...item} />}
      keyExtractor={item => item.id}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    />
  );
};
```

---

## 11. Button Component

```typescript
// components/ui/Button.tsx
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, typography } from '@/constants/design';
import { LinearGradient } from 'expo-linear-gradient';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  leftIcon,
  rightIcon,
  style,
  fullWidth,
}) => {
  const sizeStyles = {
    sm: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, fontSize: 14 },
    md: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: 16 },
    lg: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, fontSize: 18 },
  };

  const variantStyles = {
    primary: {
      backgroundColor: colors.primary,
      textColor: '#ffffff',
    },
    secondary: {
      backgroundColor: colors.secondary,
      textColor: '#ffffff',
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: colors.inputBorder,
      borderWidth: 1,
      textColor: colors.textPrimary,
    },
    ghost: {
      backgroundColor: 'transparent',
      textColor: colors.textPrimary,
    },
    danger: {
      backgroundColor: colors.danger,
      textColor: '#ffffff',
    },
  };

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={variantStyles[variant].textColor} />
      ) : (
        <>
          {leftIcon && <View style={styles.icon}>{leftIcon}</View>}
          <Text
            style={[
              styles.text,
              {
                color: variantStyles[variant].textColor,
                fontSize: sizeStyles[size].fontSize,
              },
            ]}
          >
            {title}
          </Text>
          {rightIcon && <View style={styles.icon}>{rightIcon}</View>}
        </>
      )}
    </>
  );

  const buttonStyle = [
    styles.button,
    {
      ...sizeStyles[size],
      ...variantStyles[variant],
      opacity: disabled ? 0.5 : 1,
      width: fullWidth ? '100%' : 'auto',
    },
    style,
  ];

  if (variant === 'primary' || variant === 'secondary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={
            variant === 'primary'
              ? [colors.primary, colors.primary + 'DD']
              : [colors.secondary, colors.secondary + 'DD']
          }
          style={buttonStyle}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: spacing.xs,
  },
  text: {
    ...typography.body,
    fontWeight: '600',
  },
  icon: {
    marginHorizontal: spacing.xs,
  },
});
```

---

## 12. Complete Example: Payment Screen

```typescript
// screens/PaymentScreen.tsx
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { TextInput } from '@/components/forms/TextInput';
import { Select } from '@/components/forms/Select';
import { DatePicker } from '@/components/forms/DatePicker';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { useForm } from '@/hooks/useForm';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';

const paymentSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  paymentDate: z.date(),
  receiptNumber: z.string().optional(),
});

export const PaymentScreen: React.FC = () => {
  const toast = useToast();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const form = useForm(
    {
      amount: '',
      paymentMethod: '',
      paymentDate: new Date(),
      receiptNumber: '',
    },
    paymentSchema
  );

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/parent/wards/[id]/fees/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Payment failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Payment recorded successfully');
      form.reset();
      setShowConfirmModal(false);
    },
    onError: () => {
      toast.error('Failed to record payment');
    },
  });

  const handleSubmit = () => {
    if (form.validate()) {
      setShowConfirmModal(true);
    }
  };

  const confirmPayment = () => {
    mutation.mutate(form.values);
  };

  return (
    <ScrollView style={styles.container}>
      <TextInput
        label="Amount"
        placeholder="Enter amount"
        value={form.values.amount}
        onChangeText={(text) => form.setValue('amount', text)}
        error={form.errors.amount}
        keyboardType="numeric"
      />

      <Select
        label="Payment Method"
        placeholder="Select payment method"
        value={form.values.paymentMethod}
        options={[
          { label: 'Cash', value: 'cash' },
          { label: 'Bank Transfer', value: 'bank_transfer' },
          { label: 'Mobile Money', value: 'mobile_money' },
        ]}
        onChange={(value) => form.setValue('paymentMethod', value)}
        error={form.errors.paymentMethod}
      />

      <DatePicker
        label="Payment Date"
        value={form.values.paymentDate}
        onChange={(date) => form.setValue('paymentDate', date)}
      />

      <TextInput
        label="Receipt Number (Optional)"
        placeholder="Enter receipt number"
        value={form.values.receiptNumber}
        onChangeText={(text) => form.setValue('receiptNumber', text)}
      />

      <Button
        title="Record Payment"
        onPress={handleSubmit}
        loading={mutation.isPending}
        style={styles.submitButton}
      />

      <Modal
        visible={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Payment"
        footer={
          <View style={styles.modalFooter}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setShowConfirmModal(false)}
              style={styles.modalButton}
            />
            <Button
              title="Confirm"
              onPress={confirmPayment}
              loading={mutation.isPending}
              style={styles.modalButton}
            />
          </View>
        }
      >
        <Text>Are you sure you want to record this payment?</Text>
        <Text style={styles.amountText}>Amount: {form.values.amount}</Text>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  submitButton: {
    marginTop: spacing.lg,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
  amountText: {
    ...typography.h3,
    marginTop: spacing.md,
  },
});
```

---

## Installation Requirements

```json
{
  "dependencies": {
    "react-native": "latest",
    "expo": "latest",
    "expo-linear-gradient": "~13.0.0",
    "expo-blur": "~13.0.0",
    "@react-native-community/datetimepicker": "latest",
    "react-native-toast-message": "^2.1.0",
    "zod": "^3.22.0",
    "date-fns": "^4.1.0",
    "lucide-react-native": "^0.263.0"
  }
}
```

---

**Document Version**: 1.0
**Last Updated**: 2024
**Status**: Ready for Implementation
