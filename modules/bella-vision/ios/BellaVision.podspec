Pod::Spec.new do |s|
  s.name           = 'BellaVision'
  s.version        = '1.0.0'
  s.summary        = 'On-device background removal and image labels for Bella'
  s.description    = 'Uses Apple Vision to cut items out of photos and label them.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'CoreImage'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
