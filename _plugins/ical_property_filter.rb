# Jekyll custom filter for iCalendar property escaping and folding
require 'time'

module Jekyll
  module IcalPropertyFilter
    # Escapes special characters for iCalendar fields (no Unicode escaping)
    def ical_escape(input)
      return "" if input.nil?
      input.to_s
        .gsub('\\', '\\') # Escape backslash
        .gsub(';', '\;')      # Escape semicolon
        .gsub(',', '\,')      # Escape comma
        .gsub(/\r?\n/, '\n') # Escape newlines
    end

    # Outputs a full iCalendar property, with key and value, properly escaped and folded
    def ical_property(key, value)
      return "" if key.nil? || value.nil?
      key = key.to_s
      val = ical_escape(value)
      maxlen = 75
      result = ""
      prefix = "#{key}:"
      clusters = val.scan(/\X/)
      # Build the first line with the property name
      line = prefix
      # Helper to flush a line and start a new one
      flush_line = -> {
        result << line << "\r\n"
        line.replace(" ")
      }
      clusters.each do |cluster|
        # If adding this cluster would exceed maxlen bytes, flush the line
        if (line + cluster).bytesize > maxlen
          flush_line.call
        end
        line << cluster
        # If the line (after adding) is too long (single cluster > maxlen), force split at byte boundary
        while line.bytesize > maxlen
          take = maxlen - (line.start_with?(" ") ? 1 : prefix.bytesize)
          part = line.byteslice(0, take)
          result << (line.start_with?(" ") ? " " : prefix) + part << "\r\n"
          line = " " + line.byteslice(take..-1).to_s
        end
      end
      result << line unless line == " " || line.empty?
      result.force_encoding('UTF-8')
    end
  end
end
Liquid::Template.register_filter(Jekyll::IcalPropertyFilter)
